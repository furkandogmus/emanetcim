import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { bookingService } from "@/services/BookingService";
import { authenticateGuestLookup } from "@/lib/guest-lookup-token";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";

/**
 * HESAPSIZ (token'la giren) misafirin bekleyen valiz düzeltmesini
 * onaylaması/reddetmesi.
 *
 * DEFECT_BACKLOG D5 (2026-09-12): `bag-revision.ts`teki `GUEST_APPROVAL_REQUIRED`
 * kapısı check-in sonrası fiyat artışlarını `pendingBagRevision`da bekletiyor.
 * HESAPLI misafir için bu aynı gövdeyi `actions/booking.ts`teki
 * `approveBagRevisionAction`/`rejectBagRevisionAction` çağırıyor; ikisi de
 * `BookingService.applyBagRevision` / `clearBagRevision`e çıkıyor — tek gövde,
 * iki taşıyıcı (bkz. CLAUDE.md'nin uyardığı sınıf).
 *
 * Sahiplik `guest-cancel`/`lookup/me` ile AYNI desen: `guestEmail ?? guest.email`.
 */
const CODE_TO_ERROR: Record<string, string> = {
  NOT_FOUND: "booking_not_found",
  FORBIDDEN: "unauthorized",
  INVALID_STATUS: "invalid_status",
  NO_PENDING_REVISION: "no_pending_revision",
  CAPACITY_EXCEEDED: "insufficient_capacity",
  SEAL_COUNT_MISMATCH: "seal_count_mismatch",
  INVALID_COUNTS: "invalid_counts",
  GUEST_APPROVAL_REQUIRED: "guest_approval_required",
  UNKNOWN: "revision_failed",
};

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (!(await rateLimit(`guest_bag_revision:ip:${ip}`, 20, 10 * 60_000))) {
      return NextResponse.json({ ok: false, error: "too_many_requests" }, { status: 429 });
    }

    const guest = await authenticateGuestLookup(req.headers.get("authorization"));
    if (!guest.ok) {
      return NextResponse.json({ ok: false, error: guest.code }, { status: 401 });
    }
    const payload = guest.claims;

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: payload.bookingId },
      select: {
        id: true,
        guestId: true,
        guestEmail: true,
        guest: { select: { email: true } },
      },
    });
    if (!booking) {
      return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 });
    }

    const bookingEmail = (booking.guestEmail ?? booking.guest?.email)
      ?.toLowerCase()
      .trim();
    const tokenEmail = payload.email.toLowerCase().trim();
    if (!bookingEmail || bookingEmail !== tokenEmail) {
      return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 403 });
    }

    const actor = { id: booking.guestId ?? tokenEmail, role: "GUEST" as const };
    const result =
      action === "approve"
        ? await bookingService.applyBagRevision(payload.bookingId, actor)
        : await bookingService.clearBagRevision(payload.bookingId, actor);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: CODE_TO_ERROR[result.code] ?? "revision_failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, "guest_bag_revision_failed");
    return NextResponse.json({ ok: false, error: "revision_failed" }, { status: 500 });
  }
}
