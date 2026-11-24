import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, isRateLimited } from "@/lib/internal-api-guard";
import { withJobRun } from "@/lib/jobs/run-ledger";
import logger from "@/lib/logger";

/**
 * POST /api/internal/backup-heartbeat — yedek basari kaydi.
 *
 * `scripts/backup-s3.sh` yukleme BITTIKTEN sonra cagirir; uc kendisi is yapmaz.
 * Amac `GET /api/health/jobs`in duran yedegi `stale` gostermesi: betik sifreleme
 * ayari yuzunden ya da S3 hatasiyla durursa kalp atisi gelmez.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authState === "unauthorized") {
    if (await isRateLimited(req, "backup-heartbeat", 10, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await withJobRun("backup-heartbeat", async () => ({ ok: true as const }));
  if (!outcome.ok) {
    logger.error({ error: outcome.error }, "backup_heartbeat_failed");
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
