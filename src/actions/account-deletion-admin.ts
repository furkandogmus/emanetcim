"use server";

import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { accountPrivacyService } from "@/services/AccountPrivacyService";

const ERROR_KEY: Record<string, string> = {
  not_found: "Errors.notFound",
  not_pending: "Errors.accountDeletionNotPending",
  cannot_delete_self: "Errors.accountDeletionSelf",
  active_bookings: "Errors.accountDeleteActiveBookings",
  pending_payouts: "Errors.accountDeletionPendingPayouts",
  invalid_reason: "Errors.accountDeletionReason",
};

/** Yonetici: silme talebini tamamla (anonimlestir). Mobil `admin/account-deletions/:id/complete` ile ayni servis. */
export async function completeAccountDeletionAction(
  requestId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  const r = await accountPrivacyService.completeDeletionRequest({
    requestId,
    actor: { userId: auth.actor.id, ip: await getClientIpOrNull() },
  });
  if (!r.ok) return { success: false, error: ERROR_KEY[r.reason] ?? "Errors.generic" };
  revalidatePathAllLocales("/admin/account-deletions");
  return { success: true };
}

/** Yonetici: talebi gerekceyle iptal et; kapatilan dukkanlar geri acilir. */
export async function cancelAccountDeletionAction(
  requestId: string,
  reason: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  const r = await accountPrivacyService.cancelDeletionRequest({
    requestId,
    reason: typeof reason === "string" ? reason : "",
    actor: { userId: auth.actor.id, ip: await getClientIpOrNull() },
  });
  if (!r.ok) return { success: false, error: ERROR_KEY[r.reason] ?? "Errors.generic" };
  revalidatePathAllLocales("/admin/account-deletions");
  return { success: true };
}
