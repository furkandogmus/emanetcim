import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const b = await bookingService.getBookingDetails(id);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwner = b.guestId === auth.user.id;
  if (!isOwner && auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { checkInTime, checkOutTime, bagCountS, bagCountM, bagCountXl } = body;

  if (!checkInTime || !checkOutTime) {
    return NextResponse.json({ error: "missing_dates" }, { status: 400 });
  }

  const result = await bookingService.modifyBooking(id, auth.user.id, {
    checkInTime: new Date(checkInTime),
    checkOutTime: new Date(checkOutTime),
    bagCountS: bagCountS ?? b.bagCountS,
    bagCountM: bagCountM ?? b.bagCountM,
    bagCountXl: bagCountXl ?? b.bagCountXl,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.code || "modify_failed" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
