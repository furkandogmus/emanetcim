import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingEventService } from "@/services/BookingEventService";
import { notificationService } from "@/services/NotificationService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { shop: true, guest: { select: { email: true } } },
  });

  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.shop.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.booking.updateMany({
    where: { id, shopId: booking.shopId, status: BookingStatus.WAITING_APPROVAL },
    data: { status: BookingStatus.APPROVED, bookingRowVersion: { increment: 1 } },
  });

  if (updated.count !== 1) {
    return NextResponse.json({ error: "state_conflict" }, { status: 409 });
  }

  void bookingEventService.record({
    bookingId: id,
    event: "APPROVED",
    actorId: auth.user.id,
    actorRole: "PARTNER",
  }).catch(() => {});

  if (booking.guest?.email) {
    void notificationService
      .notifyBookingApproved(booking.guest.email, id, booking.shop.name, "en")
      .catch(() => {});
  }

  return NextResponse.json({ success: true });
}
