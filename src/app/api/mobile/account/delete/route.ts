import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BookingStatus, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";
import { verifyMobileToken } from "@/lib/mobile-auth";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.WAITING_APPROVAL,
  BookingStatus.APPROVED,
  BookingStatus.PENDING,
  BookingStatus.PAID,
  BookingStatus.CHECKED_IN,
];

export async function POST(req: NextRequest) {
  const userId = await verifyMobileToken(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== Role.GUEST) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCount = await prisma.booking.count({
    where: { guestId: userId, status: { in: ACTIVE_BOOKING_STATUSES } },
  });

  if (activeCount > 0) {
    return NextResponse.json(
      { error: "Active bookings exist" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const anonEmail = `gdpr_${userId.replace(/-/g, "").slice(0, 20)}@invalid.local`;

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.review.deleteMany({ where: { guestId: userId } }),
    prisma.legalAcceptance.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        phone: null,
        name: null,
        image: null,
        passwordHash: null,
      },
    }),
  ]);

  writeAuditLog({
    actorUserId: userId,
    actorRole: "GUEST",
    action: "account.anonymize_self_mobile",
    entityType: "User",
    entityId: userId,
    ip,
  });

  return NextResponse.json({ success: true });
}
