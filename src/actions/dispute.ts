"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { notificationService } from "@/services/NotificationService";
import { bookingEventService } from "@/services/BookingEventService";
import { z } from "zod";

const disputeStatusSchema = z.enum([
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "CLOSED",
]);

export async function createDisputeAction(input: {
  bookingId: string;
  reason: "DAMAGE" | "THEFT" | "OTHER";
  description: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }

  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking || booking.guestId !== session.user.id) {
    return { success: false as const, error: "Errors.unauthorized" };
  }

  if (booking.status !== "CHECKED_IN" && booking.status !== "CHECKED_OUT") {
    return {
      success: false as const,
      error: "Errors.disputeNotReady",
    };
  }

  const existing = await prisma.dispute.findUnique({ where: { bookingId: input.bookingId } });
  if (existing) {
    return { success: false as const, error: "Errors.duplicateDispute" };
  }

  await prisma.dispute.create({
    data: {
      bookingId: input.bookingId,
      reason: input.reason,
      description: input.description,
      status: "OPEN",
    },
  });

  void bookingEventService.record({
    bookingId: input.bookingId,
    event: "DISPUTED",
    actorId: session.user.id,
    actorRole: "GUEST",
    metadata: { reason: input.reason, description: input.description },
  }).catch(() => {});

  void notificationService
    .notifyAdminsForDispute({
      bookingId: input.bookingId,
      reason: input.reason,
    })
    .catch(() => {});

  revalidatePathAllLocales("/bookings");
  revalidatePathAllLocales("/admin");
  revalidatePathAllLocales("/admin/disputes");
  return { success: true as const };
}

export async function updateDisputeStatusAction(
  disputeId: string,
  status: string,
  adminNote?: string
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false as const, error: "Errors.unauthorized" };
  }
  const parsed = disputeStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  await prisma.dispute.update({
    where: { id: disputeId },
    data: { status: parsed.data, adminNote: adminNote?.trim() || null },
  });
  revalidatePathAllLocales("/admin");
  revalidatePathAllLocales("/admin/disputes");
  revalidatePathAllLocales("/bookings");
  return { success: true as const };
}
