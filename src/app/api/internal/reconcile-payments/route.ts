import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/PaymentService";
import logger from "@/lib/logger";
import { isRateLimited } from "@/lib/internal-api-guard";

/**
 * Cron / harici job: booking PENDING + PaymentLog SUCCESS tutarsızlıklarını düzeltir.
 * Güvenlik: `Authorization: Bearer <CRON_SECRET>` veya `x-cron-secret` header.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    logger.warn({}, "reconcile_payments_disabled_no_cron_secret");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const headerSecret = req.headers.get("x-cron-secret");
  if (bearer !== secret && headerSecret !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (await isRateLimited(req, "internal_reconcile", 30, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const result = await paymentService.reconcileStalePaymentBookings();
    logger.info(
      { fixed: result.fixed, bookingIds: result.bookingIds },
      "reconcile_payments_complete"
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "reconcile_payments_failed");
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
