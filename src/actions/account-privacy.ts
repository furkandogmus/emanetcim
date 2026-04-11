"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { BookingStatus, Role } from "@prisma/client";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { headers } from "next/headers";
import { writeAuditLog } from "@/lib/audit-log";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.WAITING_APPROVAL,
  BookingStatus.APPROVED,
  BookingStatus.PENDING,
  BookingStatus.PAID,
  BookingStatus.CHECKED_IN,
];

/**
 * KVKK: misafir hesabını anonimleştirir (aktif rezervasyon yoksa).
 */
export async function anonymizeGuestAccountAction(): Promise<
  { success: true } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Errors.authRequired" };
  }
  if (session.user.role !== Role.GUEST) {
    return { success: false, error: "Errors.unauthorized" };
  }

  const userId = session.user.id;

  const activeCount = await prisma.booking.count({
    where: { guestId: userId, status: { in: ACTIVE_BOOKING_STATUSES } },
  });
  if (activeCount > 0) {
    return { success: false, error: "Errors.accountDeleteActiveBookings" };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
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
    action: "account.anonymize_self",
    entityType: "User",
    entityId: userId,
    ip,
  });

  revalidatePathAllLocales("/");
  return { success: true };
}
