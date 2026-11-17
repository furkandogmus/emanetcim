import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import { dayRangeInTimeZone, startOfDayInTimeZone } from "@/lib/timezone";
import { overdueBookingService } from "@/services/OverdueBookingService";

/**
 * Admin genel bakisi: web ana sayfasi ve mobil yonetim ekrani AYNI hesaplari buradan
 * okur. Gunluk seri once web sayfasinda satir ici yaziliydi; mobil ikinci bir kopya
 * yazsaydi gun siniri ya da ciro kumesi sessizce ayrisirdi.
 *
 * Gun sinirlari platform diliminde (Istanbul): sunucu UTC calisir, `setHours` ile
 * kurulan kovalar Istanbul'un 00:00-03:00 arasini bir onceki gune atiyordu.
 */
export const PLATFORM_TIMEZONE = "Europe/Istanbul";

const HOUR = 60 * 60 * 1000;

/**
 * `daysAgo` gun onceki gunun platform dilimindeki 00:00'i. Gece yarisindan 24 saat
 * cikarmak yerine ogleden geri sayilir: yaz saati gecisinde gun 23/25 saattir.
 */
export function startOfDaysAgo(todayStart: Date, daysAgo: number): Date {
  return startOfDayInTimeZone(PLATFORM_TIMEZONE, new Date(todayStart.getTime() + 12 * HOUR - daysAgo * 24 * HOUR));
}

/** Platform dilimindeki takvim gunu, `YYYY-MM-DD`. Kova anahtari ve eksen ayni yerden. */
export function dayKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export type DailyPoint = { date: string; revenue: number; bookings: number };

/** Bavulu henuz dukkana gelmemis, gelecegi kesin rezervasyonlar. */
const UPCOMING_STATUSES = ["APPROVED", "PAID"] as const;
const OPEN_DISPUTE_STATUSES = ["OPEN", "IN_REVIEW"];

export class AdminOverviewService {
  /** Bugun dahil son `days` gun; ciro ve adet odenmis/kazandiran rezervasyonlardan. */
  async dailySeries(days: number, now: Date = new Date()): Promise<DailyPoint[]> {
    const today = dayRangeInTimeZone(PLATFORM_TIMEZONE, now);
    const starts: Date[] = [];
    for (let i = days - 1; i >= 0; i--) starts.push(startOfDaysAgo(today.start, i));

    const rows = await prisma.booking.findMany({
      // Yari acik aralik: `lte: 23:59:59.999` son milisaniyeyi kaybediyordu.
      where: { createdAt: { gte: starts[0], lt: today.end }, status: { in: [...EARNING_BOOKING_STATUSES] } },
      select: { createdAt: true, totalPrice: true },
    });

    const buckets = new Map<string, { revenue: number; bookings: number }>();
    for (const r of rows) {
      const k = dayKey(r.createdAt);
      const b = buckets.get(k) ?? { revenue: 0, bookings: 0 };
      b.revenue += moneyToNumber(r.totalPrice);
      b.bookings += 1;
      buckets.set(k, b);
    }
    return starts.map((s) => {
      const k = dayKey(s);
      const b = buckets.get(k);
      return { date: k, revenue: b ? Math.round(b.revenue * 100) / 100 : 0, bookings: b?.bookings ?? 0 };
    });
  }

  /** Mobil yonetim ekraninin tek istekte ihtiyac duydugu her sey. */
  async overview(now: Date = new Date()) {
    const today = dayRangeInTimeZone(PLATFORM_TIMEZONE, now);

    const [
      series,
      arrivalsToday,
      pickupsToday,
      inStorage,
      newBookingsToday,
      pendingApplications,
      unreadMessages,
      openDisputes,
      overdue,
      recent,
      totalRevenue,
      totalBookings,
      activeShops,
    ] = await Promise.all([
      this.dailySeries(14, now),
      prisma.booking.count({
        where: { status: { in: [...UPCOMING_STATUSES] }, checkInTime: { gte: today.start, lt: today.end } },
      }),
      prisma.booking.count({
        where: { status: "CHECKED_IN", checkOutTime: { gte: today.start, lt: today.end } },
      }),
      prisma.booking.aggregate({
        where: { status: "CHECKED_IN" },
        _sum: { bagCountS: true, bagCountM: true, bagCountXl: true },
      }),
      prisma.booking.count({ where: { createdAt: { gte: today.start, lt: today.end } } }),
      prisma.shop.count({ where: { isActive: false } }),
      prisma.contactMessage.count({ where: { isRead: false } }),
      prisma.dispute.count({ where: { status: { in: OPEN_DISPUTE_STATUSES } } }),
      // Yalnizca okur: olay yazmaz (saglik ucuyla ayni kullanim).
      overdueBookingService.scan({ now, limit: 1, recordEvents: false }),
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          shopId: true,
          status: true,
          totalPrice: true,
          createdAt: true,
          checkInTime: true,
          checkOutTime: true,
          bagCountS: true,
          bagCountM: true,
          bagCountXl: true,
          guestEmail: true,
          shop: { select: { name: true } },
          guest: { select: { name: true } },
        },
      }),
      prisma.booking.aggregate({
        where: { status: { in: [...EARNING_BOOKING_STATUSES] } },
        _sum: { totalPrice: true },
      }),
      prisma.booking.count(),
      prisma.shop.count({ where: { isActive: true } }),
    ]);

    const s = inStorage._sum;
    return {
      series,
      today: {
        arrivals: arrivalsToday,
        pickups: pickupsToday,
        bagsInStorage: (s.bagCountS ?? 0) + (s.bagCountM ?? 0) + (s.bagCountXl ?? 0),
        newBookings: newBookingsToday,
        revenue: series[series.length - 1]?.revenue ?? 0,
      },
      attention: {
        pendingApplications,
        unreadMessages,
        openDisputes,
        overdueBookings: overdue.overdueCount,
      },
      totals: { revenue: moneyToNumber(totalRevenue._sum.totalPrice), bookings: totalBookings, activeShops },
      recent,
    };
  }
}

export const adminOverviewService = new AdminOverviewService();
