import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import prisma from "@/lib/db";

const GUEST_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "bagajpark-guest-management-secret"
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let payload: { bookingId: string; email: string };
    try {
      const { payload: p } = await jwtVerify(token, GUEST_SECRET);
      payload = p as { bookingId: string; email: string };
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid or expired token" }, { status: 401 });
    }

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
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
