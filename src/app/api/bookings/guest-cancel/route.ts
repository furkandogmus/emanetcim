import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import prisma from "@/lib/db";
import { bookingService } from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";

const GUEST_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "bagajpark-guest-management-secret"
);

export async function POST(req: NextRequest) {
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
      select: { id: true, guestEmail: true, status: true, guestId: true },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
    }

    // Verify email matches
    const bookingEmail = booking.guestEmail?.toLowerCase().trim();
    const tokenEmail = payload.email.toLowerCase().trim();
    if (bookingEmail !== tokenEmail) {
      return NextResponse.json({ ok: false, error: "Email mismatch" }, { status: 403 });
    }

    const result = await bookingService.cancelBooking(payload.bookingId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, fullRefund: result.fullRefund });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
