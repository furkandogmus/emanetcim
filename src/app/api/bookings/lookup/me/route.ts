import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateGuestLookup } from "@/lib/guest-lookup-token";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";

export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (!(await rateLimit(`booking_lookup_me:ip:${ip}`, 60, 10 * 60_000))) {
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
        guest: { select: { email: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
    }

    /*
      SAHIPLIK KONTROLU (2026-08-31'de siklastirildi). Onceki hali yalnizca
      `booking.guestEmail` sutununa bakiyordu ve `bookingEmail &&` yazdigi icin
      sutun NULL oldugunda kontrolu TAMAMEN atliyordu -- yani "e-posta yoksa
      herkes gecer". `guestEmail` giris yapmis kullanicinin actigi
      rezervasyonlarda bos kalabiliyor; o rezervasyonun sahibi
      `booking.guest.email`de.

      Ayni kural `guest-cancel` ucunda da var ve orada `guestEmail` NULL ise
      kimse gecemiyordu: ayni rezervasyon bir ucta okunabilir, digerinde iptal
      edilemezdi. Iki uc artik AYNI kaynagi kullaniyor: `guestEmail ?? guest.email`.
    */
    const bookingEmail = (booking.guestEmail ?? booking.guest?.email)
      ?.toLowerCase()
      .trim();
    const tokenEmail = payload.email.toLowerCase().trim();

    if (!bookingEmail || bookingEmail !== tokenEmail) {
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
