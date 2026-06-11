import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingEventService } from "@/services/BookingEventService";

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

  if (booking.status !== BookingStatus.WAITING_APPROVAL) {
    return NextResponse.json({ error: "state_conflict" }, { status: 409 });
  }

  await prisma.booking.update({
    where: { id },
    data: { status: BookingStatus.CANCELLED },
  });

  void bookingEventService.record({
    bookingId: id,
    event: "CANCELLED",
    actorId: auth.user.id,
    actorRole: "PARTNER",
    metadata: { reason: "partner_reject" },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
