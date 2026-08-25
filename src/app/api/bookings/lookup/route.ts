import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SignJWT } from "jose";
import { guestLookupSecret } from "@/lib/guest-lookup-token";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { email, bookingId } = await req.json();
    if (!email || !bookingId) {
      return NextResponse.json({ ok: false, error: "Missing email or booking ID" }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId.length > 8 ? bookingId : undefined,
        OR: [
          { guestEmail: email.toLowerCase().trim() },
          { guest: { email: email.toLowerCase().trim() } },
        ],
      },
      select: { id: true, guestEmail: true, guestId: true },
    });

    // Also try prefix match (first 8 chars of UUID)
    const byPrefix = !booking
      ? await prisma.booking.findFirst({
          where: {
            id: { startsWith: bookingId.substring(0, 8) },
            OR: [
              { guestEmail: email.toLowerCase().trim() },
              { guest: { email: email.toLowerCase().trim() } },
            ],
          },
          select: { id: true },
        })
      : null;

    const foundId = booking?.id || byPrefix?.id;
    if (!foundId) {
      return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
    }

    const token = await new SignJWT({ bookingId: foundId, email })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(guestLookupSecret());

    return NextResponse.json({ ok: true, token });
  } catch (e) {
    /*
      Ham hata metni İSTEMCİYE GİTMEZ (2026-08-25). `String(e)` bir Prisma
      sorgusunu, dosya yolunu veya şema adını dışarı taşıyabiliyordu; ayrıca
      hiçbir yere loglanmadığı için gerçek sebep de kayboluyordu. Sebep log'a,
      istemciye sabit bir kod.
    */
    logger.error({ err: e }, "booking_lookup_failed");
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
}
