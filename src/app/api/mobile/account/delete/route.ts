import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BookingStatus, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";
import { requireMobileUser } from "@/lib/mobile-auth";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.WAITING_APPROVAL,
  BookingStatus.APPROVED,
  BookingStatus.PENDING,
  BookingStatus.PAID,
  BookingStatus.CHECKED_IN,
];

async function handleDeleteRequest(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  if (user.role !== Role.GUEST) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const activeCount = await prisma.booking.count({
    where: { guestId: user.id, status: { in: ACTIVE_BOOKING_STATUSES } },
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

  const anonEmail = `gdpr_${user.id.replace(/-/g, "").slice(0, 20)}@invalid.local`;

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.review.deleteMany({ where: { guestId: user.id } }),
    prisma.legalAcceptance.deleteMany({ where: { userId: user.id } }),
    prisma.pushSubscription.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
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
    actorUserId: user.id,
    actorRole: "GUEST",
    action: "account.anonymize_self_mobile",
    entityType: "User",
    entityId: user.id,
    ip,
  });

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  return handleDeleteRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleDeleteRequest(req);
}
