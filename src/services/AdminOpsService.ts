import type { BookingStatus, Prisma } from "@prisma/client";

import prisma from "@/lib/db";
import { OPEN_BOOKING_STATUSES, PRE_CHECK_IN_STATUSES } from "@/lib/booking-status";
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

const PRE_CHECK_IN: BookingStatus[] = [...PRE_CHECK_IN_STATUSES];
const OPEN: BookingStatus[] = [...OPEN_BOOKING_STATUSES];
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
  async listBookings(opts: { filter: AdminBookingFilter; q?: string; now?: Date; take?: number }) {
    const now = opts.now ?? new Date();
    const search = opts.q ? searchWhere(opts.q) : null;
    const where: Prisma.BookingWhereInput = search
      ? { AND: [filterWhere(opts.filter, now), search] }
      : filterWhere(opts.filter, now);

    const [rows, counts] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: orderFor(opts.filter),
        take: Math.min(opts.take ?? 50, 100),
        select: ADMIN_BOOKING_LIST_SELECT,
      }),
      // Cipler sayiyi gostersin: arama yokken her filtrenin toplam adedi.
      Promise.all(
        ADMIN_BOOKING_FILTERS.map((f) => prisma.booking.count({ where: filterWhere(f, now) })),
      ),
    ]);

    return {
      rows,
      counts: Object.fromEntries(ADMIN_BOOKING_FILTERS.map((f, i) => [f, counts[i]])) as Record<
        AdminBookingFilter,
        number
      >,
    };
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
    const [shops, stored, arrivals, pickups] = await Promise.all([
      prisma.shop.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          district: true,
          city: true,
          capacity: true,
          rating: true,
          isPrelaunch: true,
          owner: { select: { phone: true } },
        },
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

    return shops
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
