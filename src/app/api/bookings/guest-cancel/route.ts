import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { bookingService } from "@/services/BookingService";
import { authenticateGuestLookup } from "@/lib/guest-lookup-token";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";

/** Servis iptal KODU -> bu ucun sabit dis sozlesmesi. */
const CANCEL_CODE_TO_ERROR: Record<string, string> = {
  NOT_FOUND: "booking_not_found",
  INVALID_STATUS: "cancel_not_allowed",
  REFUND_FAILED: "cancel_refund_failed",
  UNKNOWN: "cancel_failed",
};

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (!(await rateLimit(`guest_cancel:ip:${ip}`, 20, 10 * 60_000))) {
      return NextResponse.json({ ok: false, error: "too_many_requests" }, { status: 429 });
    }

    const guest = await authenticateGuestLookup(req.headers.get("authorization"));
    if (!guest.ok) {
      return NextResponse.json({ ok: false, error: guest.code }, { status: 401 });
    }
    const payload = guest.claims;

    const booking = await prisma.booking.findUnique({
      where: { id: payload.bookingId },
      select: {
        id: true,
        guestEmail: true,
        status: true,
        guestId: true,
        guest: { select: { email: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
    }

    /*
      Sahiplik kaynagi `lookup/me` ile AYNI: `guestEmail` sutunu giris yapmis
      kullanicinin rezervasyonlarinda bos kalabiliyor, sahibi `guest.email`de.
      Ayrisik olduklari surece ayni rezervasyon bir ucta okunuyor, digerinde
      iptal edilemiyordu.
    */
    const bookingEmail = (booking.guestEmail ?? booking.guest?.email)
      ?.toLowerCase()
      .trim();
    const tokenEmail = payload.email.toLowerCase().trim();
    if (!bookingEmail || bookingEmail !== tokenEmail) {
      return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 403 });
    }

    const result = await bookingService.cancelBooking(payload.bookingId);
    if (!result.ok) {
      /*
        Ham servis METNI dönmez: `result.message` Türkçe bir cümledir ve
        `ManageBookingClient` gelen değeri ekrana aynen basıyordu — Japonca
        arayüzdeki misafir Türkçe hata okuyordu. Kod zaten dönüyor.
      */
      return NextResponse.json(
        { ok: false, error: CANCEL_CODE_TO_ERROR[result.code] ?? "cancel_failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, fullRefund: result.fullRefund });
  } catch (e) {
    /*
      Ham hata metni İSTEMCİYE GİTMEZ (2026-08-25). `String(e)` bir Prisma
      sorgusunu, dosya yolunu veya şema adını dışarı taşıyabiliyordu; ayrıca
      hiçbir yere loglanmadığı için gerçek sebep de kayboluyordu. Sebep log'a,
      istemciye sabit bir kod.
    */
    logger.error({ err: e }, "guest_cancel_failed");
    return NextResponse.json({ ok: false, error: "cancel_failed" }, { status: 500 });
  }
}
