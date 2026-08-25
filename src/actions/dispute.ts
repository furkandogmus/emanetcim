"use server";

import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { notificationService } from "@/services/NotificationService";
import { bookingEventService } from "@/services/BookingEventService";
import { z } from "zod";
import logger from "@/lib/logger";
import { requireAdmin, requireUser } from "@/lib/action-auth";

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
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking || booking.guestId !== auth.actor.id) {
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
    actorId: auth.actor.id,
    actorRole: "GUEST",
    metadata: { reason: input.reason, description: input.description },
  }).catch((err) =>
    logger.error({ err, bookingId: input.bookingId }, "booking_event_disputed_failed"),
  );

  void notificationService
    .notifyAdminsForDispute({
      bookingId: input.bookingId,
      reason: input.reason,
    })
    .catch((err) =>
      logger.error({ err, bookingId: input.bookingId }, "notify_admins_dispute_failed"),
    );

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
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false as const, error: auth.error };
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
