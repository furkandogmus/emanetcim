import type { BookingStatus, Prisma } from "@prisma/client";

import prisma from "@/lib/db";
import { phoneSearchDigits } from "@/lib/admin-phone-search";
import { dayRangeInTimeZone } from "@/lib/timezone";
import { PLATFORM_TIMEZONE } from "@/services/AdminOverviewService";

/**
 * Yoneticinin sahadaki isleri icin okuma sorgulari (mobil yonetim). Yazma yok.
 *
 * Tipik kullanim: misafir destek hattini arar, "kodum 158D1519, valizim nerede?"
 * der. Kod rezervasyon id'sinin ilk 8 karakteri (bilet ve web ile ayni), yani id
 * onekiyle aranir; ad, e-posta ve dukkan adiyla da bulunur.
 */

export const ADMIN_BOOKING_FILTERS = ["arrivals", "pickups", "inStorage", "overdue", "noShow", "upcoming", "all"] as const;
export type AdminBookingFilter = (typeof ADMIN_BOOKING_FILTERS)[number];

/** Valizi henuz dukkana gelmemis durumlar. */
const PRE_CHECK_IN: BookingStatus[] = ["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"];
/** Gelecegi kesin olanlar; PENDING/WAITING_APPROVAL odeme ya da onay bekliyor. */
const CONFIRMED_PRE: BookingStatus[] = ["APPROVED", "PAID"];

function filterWhere(filter: AdminBookingFilter, now: Date): Prisma.BookingWhereInput {
  const today = dayRangeInTimeZone(PLATFORM_TIMEZONE, now);
  switch (filter) {
    case "arrivals":
      return { status: { in: CONFIRMED_PRE }, checkInTime: { gte: today.start, lt: today.end } };
    case "pickups":
      return { status: "CHECKED_IN", checkOutTime: { gte: today.start, lt: today.end } };
    case "inStorage":
      return { status: "CHECKED_IN" };
    /*
      GECIKMIS (acil): valiz dukkanda ve alma saati gecti. Dukkana hic gelmemis
      rezervasyonlar (gelmedi) bunu gurultuye cevirmesin diye ayri: "noShow".
    */
    case "overdue":
      return { status: "CHECKED_IN", checkOutTime: { lt: now } };
    // Sessiz liste: valiz hic birakilmadi, saati gecti. Kirmizi uyari yok.
    case "noShow":
      return { status: { in: PRE_CHECK_IN }, checkOutTime: { lt: now } };
    case "upcoming":
      return { status: { in: PRE_CHECK_IN }, checkInTime: { gte: now } };
    default:
      return {};
  }
}

function orderFor(filter: AdminBookingFilter): Prisma.BookingOrderByWithRelationInput {
  switch (filter) {
    case "arrivals":
    case "upcoming":
      return { checkInTime: "asc" };
    case "pickups":
    case "inStorage":
    case "overdue":
    case "noShow":
      return { checkOutTime: "asc" };
    default:
      return { createdAt: "desc" };
  }
}

function searchWhere(q: string): Prisma.BookingWhereInput | null {
  const term = q.trim();
  if (term.length < 2) return null;
  const or: Prisma.BookingWhereInput[] = [
    { guestEmail: { contains: term, mode: "insensitive" } },
    { guest: { name: { contains: term, mode: "insensitive" } } },
    { guest: { email: { contains: term, mode: "insensitive" } } },
    { shop: { name: { contains: term, mode: "insensitive" } } },
  ];
  // Telefon: en az 7 hane; kisa kodlar rastgele telefonlarla eslesmesin.
  const digits = phoneSearchDigits(term);
  if (digits) or.push({ guestPhone: { contains: digits } }, { guest: { phone: { contains: digits } } });
  // Bilet kodu: id'nin ilk 8 karakteri buyuk harfle gosteriliyor; id kucuk harf.
  if (/^[0-9a-f-]{4,36}$/i.test(term)) or.push({ id: { startsWith: term.toLowerCase() } });
  return { OR: or };
}

export const ADMIN_BOOKING_LIST_SELECT = {
  id: true,
  shopId: true,
  status: true,
  checkInTime: true,
  checkOutTime: true,
  bagCountS: true,
  bagCountM: true,
  bagCountXl: true,
  totalPrice: true,
  createdAt: true,
  guestEmail: true,
  shop: { select: { name: true } },
  guest: { select: { name: true, email: true } },
} satisfies Prisma.BookingSelect;

export class AdminOpsService {
  /**
   * Bilet kodu aramasi asil kullanim ve tam bir eslesmesi var: once YALNIZCA kodla
   * bakilir. Dort tabloyu kapsayan ILIKE + id oneki OR'u tek sonuclu aramada LIMIT ile
   * erken duramaz ve tum tabloyu gezer (id oneki en_US.utf8'de indeksi kullanamaz,
   * DEFECT_BACKLOG). Kod bulunamazsa ad/e-posta/dukkan aramasina dusulur.
   */
  async listBookings(opts: { filter: AdminBookingFilter; q?: string; now?: Date; take?: number }) {
    const now = opts.now ?? new Date();
    const take = Math.min(opts.take ?? 50, 100);
    const base = filterWhere(opts.filter, now);
    const term = (opts.q ?? "").trim();

    if (/^[0-9a-f]{4,8}$/i.test(term)) {
      const byCode = await prisma.booking.findMany({
        where: { AND: [base, { id: { startsWith: term.toLowerCase() } }] },
        orderBy: orderFor(opts.filter),
        take,
        select: ADMIN_BOOKING_LIST_SELECT,
      });
      if (byCode.length > 0) return byCode;
    }

    const search = searchWhere(term);
    return prisma.booking.findMany({
      where: search ? { AND: [base, search] } : base,
      orderBy: orderFor(opts.filter),
      take,
      select: ADMIN_BOOKING_LIST_SELECT,
    });
  }

  /**
   * Cip sayilari arama metnine ve secili suzgece bagli degil: ayri uc/onbellek, liste
   * istegi tek sorgu kalir.
   */
  async bookingCounts(now: Date = new Date()) {
    const counts = await Promise.all(
      ADMIN_BOOKING_FILTERS.map((f) => prisma.booking.count({ where: filterWhere(f, now) })),
    );
    return Object.fromEntries(ADMIN_BOOKING_FILTERS.map((f, i) => [f, counts[i]])) as Record<
      AdminBookingFilter,
      number
    >;
  }

  async bookingDetail(id: string) {
    const [booking, events] = await Promise.all([
      prisma.booking.findUnique({
        where: { id },
        select: {
          ...ADMIN_BOOKING_LIST_SELECT,
          guestPhone: true,
          checkedInAt: true,
          checkedOutAt: true,
          couponCode: true,
          guest: { select: { id: true, name: true, email: true, phone: true } },
          shop: {
            select: {
              name: true,
              address: true,
              district: true,
              city: true,
              latitude: true,
              longitude: true,
              owner: { select: { id: true, name: true, phone: true } },
            },
          },
          seals: { select: { sealNumber: true, bagIndex: true, bagSize: true }, orderBy: { bagIndex: "asc" } },
          dispute: { select: { status: true } },
          paymentLog: { select: { status: true } },
        },
      }),
      prisma.bookingEvent.findMany({
        where: { bookingId: id },
        orderBy: { createdAt: "asc" },
        select: { event: true, actorRole: true, createdAt: true },
        take: 50,
      }),
    ]);
    return booking ? { booking, events } : null;
  }

  /** Aktif dukkanlar, su an icerideki valizle doluluk sirasina gore. */
  async shopsOccupancy(now: Date = new Date()) {
    const today = dayRangeInTimeZone(PLATFORM_TIMEZONE, now);
    const select = {
      id: true,
      name: true,
      district: true,
      city: true,
      capacity: true,
      rating: true,
      isPrelaunch: true,
      isActive: true,
      isTest: true,
      isVerified: true,
      image: true,
      latitude: true,
      longitude: true,
      owner: { select: { phone: true } },
    } as const;
    const [realShops, prelaunchShops, stored, arrivals, pickups] = await Promise.all([
      // Gercek dukkanlar tavansiz. Eskiden tek sorgu siralamasiz `take: 300` idi ve
      // 490 talep testi noktasi arasinda gercek esnaflar rastgele dusuyordu (2026-11-19).
      // Pasif gercek dukkanlar da gelir: mobil admin onlari yeniden acabilsin.
      prisma.shop.findMany({ where: { isPrelaunch: false }, select }),
      // Sayfalama gelene kadar tavan: binlerce noktada yanit MB'larca olmasin.
      prisma.shop.findMany({
        where: { isActive: true, isPrelaunch: true },
        orderBy: [{ city: "asc" }, { name: "asc" }],
        take: 1000,
        select,
      }),
      prisma.booking.groupBy({
        by: ["shopId"],
        where: { status: "CHECKED_IN" },
        _sum: { bagCountS: true, bagCountM: true, bagCountXl: true },
      }),
      prisma.booking.groupBy({
        by: ["shopId"],
        where: { status: { in: CONFIRMED_PRE }, checkInTime: { gte: today.start, lt: today.end } },
        _count: { _all: true },
      }),
      prisma.booking.groupBy({
        by: ["shopId"],
        where: { status: "CHECKED_IN", checkOutTime: { gte: today.start, lt: today.end } },
        _count: { _all: true },
      }),
    ]);

    const bags = new Map(
      stored.map((s) => [s.shopId, (s._sum.bagCountS ?? 0) + (s._sum.bagCountM ?? 0) + (s._sum.bagCountXl ?? 0)]),
    );
    const arr = new Map(arrivals.map((a) => [a.shopId, a._count._all]));
    const pick = new Map(pickups.map((p) => [p.shopId, p._count._all]));

    return [...realShops, ...prelaunchShops]
      .map((s) => ({
        ...s,
        bagsInStorage: bags.get(s.id) ?? 0,
        arrivalsToday: arr.get(s.id) ?? 0,
        pickupsToday: pick.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.bagsInStorage / Math.max(1, b.capacity) - a.bagsInStorage / Math.max(1, a.capacity));
  }

  /** Mobil admin dukkan karti: kimlik, bayraklar, sahip, doluluk ve son rezervasyonlar. */
  async shopDetail(id: string, now: Date = new Date()) {
    const today = dayRangeInTimeZone(PLATFORM_TIMEZONE, now);
    const shop = await prisma.shop.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        district: true,
        city: true,
        capacity: true,
        rating: true,
        pricePerDay: true,
        isActive: true,
        isTest: true,
        isVerified: true,
        isPrelaunch: true,
        image: true,
        latitude: true,
        longitude: true,
        open247: true,
        openingTime: true,
        closingTime: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { bookings: true, reviews: true } },
      },
    });
    if (!shop) return null;
    const [stored, arrivals, pickups, recent] = await Promise.all([
      prisma.booking.aggregate({
        where: { shopId: id, status: "CHECKED_IN" },
        _sum: { bagCountS: true, bagCountM: true, bagCountXl: true },
      }),
      prisma.booking.count({
        where: { shopId: id, status: { in: ["APPROVED", "PAID"] }, checkInTime: { gte: today.start, lt: today.end } },
      }),
      prisma.booking.count({
        where: { shopId: id, status: "CHECKED_IN", checkOutTime: { gte: today.start, lt: today.end } },
      }),
      prisma.booking.findMany({
        where: { shopId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: ADMIN_BOOKING_LIST_SELECT,
      }),
    ]);
    return {
      shop,
      bagsInStorage: (stored._sum.bagCountS ?? 0) + (stored._sum.bagCountM ?? 0) + (stored._sum.bagCountXl ?? 0),
      arrivalsToday: arrivals,
      pickupsToday: pickups,
      recent,
    };
  }
}

export const adminOpsService = new AdminOpsService();
