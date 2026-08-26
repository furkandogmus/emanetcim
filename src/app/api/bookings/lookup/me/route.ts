import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateGuestLookup } from "@/lib/guest-lookup-token";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const guest = await authenticateGuestLookup(req.headers.get("authorization"));
    if (!guest.ok) {
      return NextResponse.json({ ok: false, error: guest.code }, { status: 401 });
    }
    const payload = guest.claims;

    const booking = await prisma.booking.findUnique({
      where: { id: payload.bookingId },
      select: {
        id: true,
        shop: { select: { name: true, address: true } },
        checkInTime: true,
        checkOutTime: true,
        totalPrice: true,
        bagCountS: true,
        bagCountM: true,
        bagCountXl: true,
        status: true,
        qrCodeToken: true,
        guestEmail: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
    }

    const bookingEmail = booking.guestEmail?.toLowerCase().trim();
    const tokenEmail = payload.email.toLowerCase().trim();

    if (bookingEmail && bookingEmail !== tokenEmail) {
      return NextResponse.json({ ok: false, error: "Email mismatch" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        shopName: booking.shop.name,
        shopAddress: booking.shop.address,
        checkInTime: booking.checkInTime.toISOString(),
        checkOutTime: booking.checkOutTime.toISOString(),
        totalPrice: Number(booking.totalPrice),
        bagCountS: booking.bagCountS,
        bagCountM: booking.bagCountM,
        bagCountXl: booking.bagCountXl,
        status: booking.status,
        qrCodeToken: booking.qrCodeToken,
      },
    });
  } catch (e) {
    /*
      Ham hata metni İSTEMCİYE GİTMEZ (2026-08-25). `String(e)` bir Prisma
      sorgusunu, dosya yolunu veya şema adını dışarı taşıyabiliyordu; ayrıca
      hiçbir yere loglanmadığı için gerçek sebep de kayboluyordu. Sebep log'a,
      istemciye sabit bir kod.
    */
    logger.error({ err: e }, "booking_lookup_me_failed");
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
}
