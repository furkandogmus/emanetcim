import prisma from "@/lib/db";
import logger from "@/lib/logger";
import type { AppPlatform } from "@/lib/app-stores";

export type AppLinkOutcome = "redirect" | "landing";

/**
 * `/app` isabetini yazar. FIRLATMAZ: kayit olcum icindir, yonlendirmeyi
 * asla bozmamali (bot, DB kesintisi, hiz siniri).
 */
export async function recordAppLinkHit(hit: {
  source: string;
  platform: AppPlatform;
  outcome: AppLinkOutcome;
}): Promise<void> {
  try {
    await prisma.appLinkHit.create({ data: hit });
  } catch (err) {
    logger.warn({ err }, "app_link_hit_record_failed");
  }
}

export type AppLinkStatRow = {
  source: string;
  platform: string;
  outcome: string;
  count: number;
};

export const APP_LINK_STATS_LIMIT = 50;
/** Isabetler bu kadar gun tutulur; `cleanup` isi eskisini siler. */
export const APP_LINK_RETENTION_DAYS = 90;

/**
 * Son `days` gundeki isabetler, kaynak x platform x sonuc. En buyuk
 * `APP_LINK_STATS_LIMIT` grup doner; kalanlarin toplami `restCount`
 * (her `afis-<id>` ayri grup, dukkan sayisi buyudukce tablo tasmasin).
 */
export async function getAppLinkStats(
  days = 30,
  now = new Date(),
): Promise<{ rows: AppLinkStatRow[]; restCount: number }> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const groups = await prisma.appLinkHit.groupBy({
    by: ["source", "platform", "outcome"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const all = groups
    .map((r) => ({ source: r.source, platform: r.platform, outcome: r.outcome, count: r._count._all }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  const rows = all.slice(0, APP_LINK_STATS_LIMIT);
  const restCount = all.slice(APP_LINK_STATS_LIMIT).reduce((n, r) => n + r.count, 0);
  return { rows, restCount };
}

/** `APP_LINK_RETENTION_DAYS`ten eski isabetleri siler; silinen sayiyi doner. */
export async function purgeOldAppLinkHits(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - APP_LINK_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const res = await prisma.appLinkHit.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return res.count;
}
