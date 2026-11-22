import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, isRateLimited } from "@/lib/internal-api-guard";
import logger from "@/lib/logger";
import { withJobRun } from "@/lib/jobs/run-ledger";
import { closeExpiredBookings } from "@/services/booking/closure";

/**
 * POST /api/internal/close-expired-bookings — valizi hic birakilmamis ve alma
 * saatinin uzerinden 6 saat gecmis rezervasyonlari `CANCELLED`
 * (`expired_no_dropoff`) yapar; slot ve kupon `cancelBooking`te serbest kalir.
 * Tekrar calistirmak zararsiz. Kural ve gerekce `src/services/booking/closure.ts`.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    logger.warn({}, "close_expired_bookings_disabled_no_cron_secret");
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authState === "unauthorized") {
    if (await isRateLimited(req, "close-expired-bookings", 10, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await withJobRun("close-expired-bookings", async () => {
    const summary = await closeExpiredBookings();
    return { ok: true as const, detail: summary };
  });

  if (!outcome.ok) {
    logger.error({ error: outcome.error }, "close_expired_bookings_failed");
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...outcome.detail });
}
