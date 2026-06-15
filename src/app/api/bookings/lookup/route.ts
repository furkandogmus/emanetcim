import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SignJWT } from "jose";

const GUEST_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "bagajpark-guest-management-secret"
);

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
      .sign(GUEST_SECRET);

    return NextResponse.json({ ok: true, token });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
