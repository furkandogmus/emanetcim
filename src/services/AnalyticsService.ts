import prisma from "@/lib/db";
import logger from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import type { AnalyticsEventName } from "@/lib/analytics-events";

const MAX_FIELD_LENGTH = 256;
const MAX_METADATA_JSON_LENGTH = 2000;

export type TrackEventInput = {
  name: AnalyticsEventName;
  sessionId: string;
  userId?: string | null;
  path?: string | null;
  referrer?: string | null;
  locale?: string | null;
  metadata?: Prisma.InputJsonValue;
};

function clamp(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, MAX_FIELD_LENGTH);
}

function clampMetadata(
  metadata: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonValue | undefined {
  if (metadata === undefined) return undefined;
  const json = JSON.stringify(metadata);
  if (json.length <= MAX_METADATA_JSON_LENGTH) return metadata;
  // Aşırı büyük bir gövde göndermeye çalışan (kasıtlı ya da hatalı) bir istemciyi
  // olduğu gibi veritabanına yazmak yerine, olayı içerik olmadan kaydet — olay
  // sayısı hâlâ doğru, yalnızca ayrıntı düşüyor.
  return { truncated: true };
}

/**
 * Birinci taraf kullanıcı analitiği — tek doğruluk kaynağı.
 *
 * Yazma buradan geçer (CLAUDE.md: "yazma yalnızca src/services/ üzerinden").
 * `track()` best-effort'tur: hata olayı yutulur ve loglanır, çağıranın akışını
 * hiçbir zaman bloklamaz ya da bozmaz — bir analitik yazma hatası bir rezervasyonu
 * ya da kaydı asla engellememeli.
 */
class AnalyticsService {
  track(input: TrackEventInput): void {
    void prisma.analyticsEvent
      .create({
        data: {
          name: input.name,
          sessionId: clamp(input.sessionId) ?? "unknown",
          userId: input.userId ?? null,
          path: clamp(input.path),
          referrer: clamp(input.referrer),
          locale: clamp(input.locale),
          metadata: clampMetadata(input.metadata),
        },
      })
      .catch((err) => {
        logger.error({ err, name: input.name }, "analytics_track_failed");
      });
  }

  /**
   * Admin panelindeki `/admin/analytics` sayfası için özet. Ön-hesaplanmış
   * tablo/cron YOK — bu ölçekte (bkz. docs/DEFECT_BACKLOG.md'deki dükkan/rezervasyon
   * sayıları) doğrudan agregasyon yeterince hızlı; erken optimizasyon yapılmadı.
   */
  async getDashboardSummary(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [countsByName, uniqueSessionsRaw, topPathsRaw, topShopsRaw] =
      await Promise.all([
        prisma.analyticsEvent.groupBy({
          by: ["name"],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.findMany({
          where: { createdAt: { gte: since } },
          distinct: ["sessionId"],
          select: { sessionId: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["path"],
          where: { createdAt: { gte: since }, name: "page_view", path: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { path: "desc" } },
          take: 10,
        }),
        prisma.$queryRaw<Array<{ shopId: string; count: bigint }>>`
          SELECT metadata->>'shopId' AS "shopId", COUNT(*) AS count
          FROM "AnalyticsEvent"
          WHERE name = 'shop_view'
            AND "createdAt" >= ${since}
            AND metadata->>'shopId' IS NOT NULL
          GROUP BY metadata->>'shopId'
          ORDER BY count DESC
          LIMIT 10
        `,
      ]);

    const counts = Object.fromEntries(
      countsByName.map((c) => [c.name, c._count._all]),
    ) as Record<string, number>;

    const shopIds = topShopsRaw.map((r) => r.shopId);
    const shops = shopIds.length
      ? await prisma.shop.findMany({
          where: { id: { in: shopIds } },
          select: { id: true, name: true },
        })
      : [];
    const shopNameById = new Map(shops.map((s) => [s.id, s.name]));

    return {
      days,
      uniqueSessions: uniqueSessionsRaw.length,
      pageViews: counts["page_view"] ?? 0,
      searches: counts["search_performed"] ?? 0,
      shopViews: counts["shop_view"] ?? 0,
      checkoutsStarted: counts["checkout_started"] ?? 0,
      bookingsCreated: counts["booking_created"] ?? 0,
      newUsers: counts["user_signed_up"] ?? 0,
      topPaths: topPathsRaw.map((r) => ({
        path: r.path ?? "—",
        count: r._count._all,
      })),
      topShops: topShopsRaw.map((r) => ({
        shopId: r.shopId,
        name: shopNameById.get(r.shopId) ?? r.shopId,
        count: Number(r.count),
      })),
    };
  }

  /**
   * Partner panelinde "bu ay dükkanınız kaç kez görüntülendi" kartı için.
   * Esnafa platformun getirdiği görünürlüğü somutlaştırıyor — DEFECT_BACKLOG'daki
   * "esnaf ne kadar kazandığını göremiyor" temasının görünürlük tarafı.
   */
  async getShopViewCountThisMonth(shopId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return prisma.analyticsEvent.count({
      where: {
        name: "shop_view",
        createdAt: { gte: startOfMonth },
        metadata: { path: ["shopId"], equals: shopId },
      },
    });
  }
}

export const analyticsService = new AnalyticsService();
