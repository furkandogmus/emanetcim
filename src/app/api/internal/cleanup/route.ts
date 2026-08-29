import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withJobRun } from "@/lib/jobs/run-ledger";
import logger from "@/lib/logger";
import { authorizeCron } from "@/lib/internal-api-guard";

// Yerel `authorize()` kopyası kaldırıldı (2026-08-22): sır karşılaştırmasını `===`
// ile yapıyordu, yani sabit zamanlı değildi ve dört uçtaki kopyalardan biriydi.
// Ortak guard `crypto.timingSafeEqual` kullanıyor.

/**
 * Veritabanı Hijyeni: Süresi geçmiş token ve oturumları temizleme.
 * Günde bir kez çalıştırılması önerilir.
 */
async function runCleanup(req: NextRequest): Promise<NextResponse> {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (authState === "unauthorized") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Defter kaydi: HTTP 200 donmek yetmiyor, is CALISTIGINI JobRun'a yazmali.
  // Yoksa /api/health/jobs bu isi hic gormez ve enforced=true yapildiginda
  // sonsuza dek "gecikmis" gorunur (2026-08-29: sekiz isten dordu boyleydi).
  const outcome = await withJobRun("cleanup", async () => {
    const now = new Date();
    const analyticsRetentionCutoff = new Date(
      now.getTime() - 90 * 24 * 60 * 60 * 1000,
    );

    const [deletedTokens, deletedSessions, deletedAnalyticsEvents] =
      await prisma.$transaction([
        prisma.verificationToken.deleteMany({
          where: { expires: { lt: now } },
        }),
        prisma.session.deleteMany({
          where: { expires: { lt: now } },
        }),
        // AnalyticsEvent sınırsız büyümesin diye 90 günden eskisi silinir —
        // bkz. docs/KOD_TARAMA_2026-08-23.md, kullanıcı analitiği bölümü.
        prisma.analyticsEvent.deleteMany({
          where: { createdAt: { lt: analyticsRetentionCutoff } },
        }),
      ]);

    logger.info(
      {
        deletedTokens: deletedTokens.count,
        deletedSessions: deletedSessions.count,
        deletedAnalyticsEvents: deletedAnalyticsEvents.count,
      },
      "database_cleanup_success"
    );

    return {
      ok: true as const,
      detail: {
        deletedTokens: deletedTokens.count,
        deletedSessions: deletedSessions.count,
        deletedAnalyticsEvents: deletedAnalyticsEvents.count,
      },
    };
  });

  if (!outcome.ok) {
    logger.error({ error: outcome.error }, "database_cleanup_failed");
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...outcome.detail });
}

export async function GET(req: NextRequest) {
  return runCleanup(req);
}

export async function POST(req: NextRequest) {
  return runCleanup(req);
}
