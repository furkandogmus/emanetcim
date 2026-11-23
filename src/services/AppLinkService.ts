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

/** Son `days` gundeki isabetler, kaynak x platform x sonuc. */
export async function getAppLinkStats(days = 30, now = new Date()): Promise<AppLinkStatRow[]> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.appLinkHit.groupBy({
    by: ["source", "platform", "outcome"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ source: r.source, platform: r.platform, outcome: r.outcome, count: r._count._all }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}
