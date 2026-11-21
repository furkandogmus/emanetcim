import { OPERATING_SHOP_FILTER } from "@/lib/public-shop-filter";
import prisma from "@/lib/db";
import { PENDING_APPLICATION_WHERE } from "@/lib/pending-application";
import { moneyToNumber } from "@/lib/money";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import { dayRangeInTimeZone, startOfDayInTimeZone } from "@/lib/timezone";

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

  /**
   * Tum zamanlar toplamlari tum Booking tablosunu okur ve dakikalar icinde anlamli
   * degismez: surec icinde 5 dk tutulur (tek konteyner; yeniden baslatmada sifirlanir).
   */
  private totalsCache: { at: number; value: { revenue: number; bookings: number; activeShops: number } } | null = null;

  async totals(now: Date = new Date()) {
    if (this.totalsCache && now.getTime() - this.totalsCache.at < 5 * 60 * 1000) return this.totalsCache.value;
    const [revenue, bookings, activeShops] = await Promise.all([
      prisma.booking.aggregate({ where: { status: { in: [...EARNING_BOOKING_STATUSES] } }, _sum: { totalPrice: true } }),
      prisma.booking.count(),
      // Talep testi noktalari ve test kayitlari esnaf degil: sayi 12 yerine 504 diyordu (2026-11-19).
      prisma.shop.count({ where: OPERATING_SHOP_FILTER }),
    ]);
    const value = { revenue: moneyToNumber(revenue._sum.totalPrice), bookings, activeShops };
    this.totalsCache = { at: now.getTime(), value };
    return value;
  }

  /** Mobil yonetim ekraninin tek istekte ihtiyac duydugu her sey. */
  async overview(now: Date = new Date()) {
    const today = dayRangeInTimeZone(PLATFORM_TIMEZONE, now);

    const [series, [snap], pendingApplications, unreadMessages, openDisputes, recent, totals] = await Promise.all([
      this.dailySeries(14, now),
      // Bugunun sayilari, dukkandaki valiz ve gecikmis TEK sorguda: havuz 10 baglanti,
      // bu uc eskiden 15+ paralel sorgu aciyordu (DEFECT_BACKLOG 2026-08-31 kurali).
      // Gecikmis tanimi OverdueBookingService ile ayni (acik + cikis saati gecmis).
      prisma.$queryRaw<
        { arrivals: bigint; pickups: bigint; bags: bigint | null; new_today: bigint; overdue: bigint }[]
      >`
        SELECT
          count(*) FILTER (WHERE status IN ('APPROVED','PAID')
            AND "checkInTime" >= ${today.start} AND "checkInTime" < ${today.end}) AS arrivals,
          count(*) FILTER (WHERE status = 'CHECKED_IN'
            AND "checkOutTime" >= ${today.start} AND "checkOutTime" < ${today.end}) AS pickups,
          sum("bagCountS" + "bagCountM" + "bagCountXl") FILTER (WHERE status = 'CHECKED_IN') AS bags,
          count(*) FILTER (WHERE "createdAt" >= ${today.start} AND "createdAt" < ${today.end}) AS new_today,
          count(*) FILTER (WHERE status IN ('PENDING','WAITING_APPROVAL','APPROVED','PAID','CHECKED_IN')
            AND "checkOutTime" < ${now}) AS overdue
        FROM "Booking"
        WHERE status IN ('PENDING','WAITING_APPROVAL','APPROVED','PAID','CHECKED_IN')
          OR "createdAt" >= ${today.start}
      `,
      prisma.shop.count({ where: PENDING_APPLICATION_WHERE }),
      prisma.contactMessage.count({ where: { isRead: false } }),
      prisma.dispute.count({ where: { status: { in: OPEN_DISPUTE_STATUSES } } }),
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
      this.totals(now),
    ]);

    return {
      series,
      today: {
        arrivals: Number(snap?.arrivals ?? 0),
        pickups: Number(snap?.pickups ?? 0),
        bagsInStorage: Number(snap?.bags ?? 0),
        newBookings: Number(snap?.new_today ?? 0),
        revenue: series[series.length - 1]?.revenue ?? 0,
      },
      attention: {
        pendingApplications,
        unreadMessages,
        openDisputes,
        overdueBookings: Number(snap?.overdue ?? 0),
      },
      totals,
      recent,
    };
  }
}

export const adminOverviewService = new AdminOverviewService();
