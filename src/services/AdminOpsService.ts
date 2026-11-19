import type { BookingStatus, Prisma } from "@prisma/client";

import prisma from "@/lib/db";
import { dayRangeInTimeZone } from "@/lib/timezone";
import { PLATFORM_TIMEZONE } from "@/services/AdminOverviewService";

/**
 * Yoneticinin sahadaki isleri icin okuma sorgulari (mobil yonetim). Yazma yok.
 *
 * Tipik kullanim: misafir destek hattini arar, "kodum 158D1519, valizim nerede?"
 * der. Kod rezervasyon id'sinin ilk 8 karakteri (bilet ve web ile ayni), yani id
 * onekiyle aranir; ad, e-posta ve dukkan adiyla da bulunur.
 */

export const ADMIN_BOOKING_FILTERS = ["arrivals", "pickups", "inStorage", "overdue", "upcoming", "all"] as const;
export type AdminBookingFilter = (typeof ADMIN_BOOKING_FILTERS)[number];

/** Valizi henuz dukkana gelmemis durumlar. */
const PRE_CHECK_IN: BookingStatus[] = ["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"];
/**
 * Cikis saati gectiginde hala acik sayilanlar: `OverdueBookingService.OPEN_STATUSES`
 * ile AYNI liste (orada disa acik degil). Ortak bir sabite tasininca ikisi de onu okumali.
 */
const OPEN: BookingStatus[] = [...PRE_CHECK_IN, "CHECKED_IN"];
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
    // OverdueBookingService ile ayni tanim: cikis saati gecmis ve hala acik.
    case "overdue":
      return { status: { in: OPEN }, checkOutTime: { lt: now } };
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
          guest: { select: { name: true, email: true, phone: true } },
          shop: {
            select: {
              name: true,
              address: true,
              district: true,
              city: true,
              latitude: true,
              longitude: true,
              owner: { select: { name: true, phone: true } },
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
      owner: { select: { phone: true } },
    } as const;
    const [realShops, prelaunchShops, stored, arrivals, pickups] = await Promise.all([
      // Gercek dukkanlar tavansiz. Eskiden tek sorgu siralamasiz `take: 300` idi ve
      // 490 talep testi noktasi arasinda gercek esnaflar rastgele dusuyordu (2026-11-19).
      prisma.shop.findMany({ where: { isActive: true, isPrelaunch: false }, select }),
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
}

export const adminOpsService = new AdminOpsService();
