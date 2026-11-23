import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, isRateLimited } from "@/lib/internal-api-guard";
import logger from "@/lib/logger";
import { withJobRun } from "@/lib/jobs/run-ledger";
import { lateDropoffService } from "@/services/LateDropoffService";

/**
 * POST /api/internal/late-dropoff-scan — gec birakma: hatirlatma (+15/+30/+45 dk,
 * +45'te esnafa da) ve +60 dk'da (ya da bekletme bitince) otomatik kapanis.
 * 5 dk'da bir; tekrar calistirmak zararsiz. Kural `src/lib/late-dropoff.ts`.
 * Eski gece isi `close-expired-bookings`in (alma + 6 sa) yerine gecer.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    logger.warn({}, "late_dropoff_scan_disabled_no_cron_secret");
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authState === "unauthorized") {
    if (await isRateLimited(req, "late-dropoff-scan", 10, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await withJobRun("late-dropoff-scan", async () => {
    const report = await lateDropoffService.run();
    return { ok: true as const, detail: report };
  });

  if (!outcome.ok) {
    logger.error({ error: outcome.error }, "late_dropoff_scan_failed");
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...outcome.detail });
}
