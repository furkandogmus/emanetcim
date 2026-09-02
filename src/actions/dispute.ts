"use server";

import { DISPUTE_STATUSES } from "@/lib/dispute-status";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { disputeService } from "@/services/DisputeService";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/action-auth";

// Liste `@/lib/dispute-status`ta; gerekcesi orada.
const disputeStatusSchema = z.enum(DISPUTE_STATUSES);

export async function createDisputeAction(input: {
  bookingId: string;
  reason: "DAMAGE" | "THEFT" | "OTHER";
  description: string;
}) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };

  /*
    GOVDE `DisputeService`TE. Ayni is mobil ucta da yaziliydi ve orada IKI SEY
    birden atlaniyordu: rezervasyon zaman cizelgesine `DISPUTED` izi ve
    ADMINLERE BILDIRIM. Yani mobilden acilan bir hasar/hirsizlik sikayeti
    kimseye haber vermiyordu. Burada kalan tek is oturum cozumu, hata anahtari
    eslemesi ve `revalidate`.
  */
  const result = await disputeService.create({
    bookingId: input.bookingId,
    guestId: auth.actor.id,
    reason: input.reason,
    description: input.description,
  });
  if (!result.ok) {
    const ERROR_KEYS = {
      not_found: "Errors.unauthorized",
      not_owner: "Errors.unauthorized",
      booking_not_ready: "Errors.disputeNotReady",
      duplicate: "Errors.duplicateDispute",
    } as const;
    return { success: false as const, error: ERROR_KEYS[result.reason] };
  }

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
