import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { monthRangeInTimeZone } from "@/lib/timezone";
import { BOOKING_SOURCES, type BookingSource } from "@/lib/booking-source";
import { safeTimezone } from "@/services/PartnerEarningsService";

export type ShopSourceCounts = { poster: number; walkIn: number };
export type ShopSourceStats = { thisMonth: ShopSourceCounts; lastMonth: ShopSourceCounts };
export type SourceBreakdown = Record<BookingSource | "unknown", number>;

/** Iptal edilen (gelmedi dahil) rezervasyon kanal basarisi sayilmaz. */
const COUNTED = { status: { not: "CANCELLED" as const } };

/**
 * Kanal istatistigi ve afis atfinin dukkan dogrulamasi. Sayimlar yalnizca gosterge;
 * bonus/komisyon yok (sahip karari 2026-11-25).
 */
export class BookingSourceService {
  /**
   * Afis atfindaki dukkan gercek ve isletilen bir dukkan mi? Degilse atif dusurulur,
   * rezervasyon yine olusur (kanal `web`/`app` kalir).
   */
  async resolvePosterShop(shopId: string | null): Promise<string | null> {
    if (!shopId) return null;
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, isActive: true, isTest: true },
      });
      return shop && shop.isActive && !shop.isTest ? shop.id : null;
    } catch (err) {
      logger.warn({ err }, "poster_attribution_lookup_failed");
      return null;
    }
  }

  /** Dukkan paneli: bu ay ve gecen ay afisten / kapidan gelen rezervasyon sayisi. */
  async shopStats(shopId: string, timezone: string | null | undefined, now: Date = new Date()): Promise<ShopSourceStats> {
    const tz = safeTimezone(timezone);
    const ranges = [monthRangeInTimeZone(tz, now, 0), monthRangeInTimeZone(tz, now, 1)];
    const counts = await Promise.all(
      ranges.flatMap((r) => {
        const createdAt = { gte: r.start, lt: r.end };
        return [
          prisma.booking.count({ where: { sourceShopId: shopId, source: "poster", createdAt, ...COUNTED } }),
          prisma.booking.count({ where: { shopId, source: "walk_in", createdAt, ...COUNTED } }),
        ];
      }),
    );
    return {
      thisMonth: { poster: counts[0], walkIn: counts[1] },
      lastMonth: { poster: counts[2], walkIn: counts[3] },
    };
  }

  /** Yonetici analitigi: son `days` gunde kanal dagilimi (`unknown` = alandan onceki kayit). */
  async breakdown(days: number, now: Date = new Date()): Promise<SourceBreakdown> {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const groups = await prisma.booking.groupBy({
      by: ["source"],
      where: { createdAt: { gte: since }, ...COUNTED },
      _count: { _all: true },
    });
    const out: SourceBreakdown = { web: 0, app: 0, walk_in: 0, poster: 0, unknown: 0 };
    for (const g of groups) {
      const key = (BOOKING_SOURCES as readonly string[]).includes(g.source ?? "") ? (g.source as BookingSource) : "unknown";
      out[key] += g._count._all;
    }
    return out;
  }
}

export const bookingSourceService = new BookingSourceService();
