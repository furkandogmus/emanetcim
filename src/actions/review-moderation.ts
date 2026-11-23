"use server";

import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { reviewService } from "@/services/ReviewService";

const ERROR_KEY: Record<string, string> = {
  not_found: "Errors.notFound",
  already_hidden: "Errors.reviewAlreadyHidden",
  not_hidden: "Errors.reviewNotHidden",
  reason_required: "Errors.reviewReasonRequired",
};

/** Web yorum moderasyonu: gizle / geri al / sil. Mobil `admin/reviews/:id/:action` ile ayni `ReviewService.moderate`. */
export async function moderateReviewAction(input: {
  reviewId: string;
  action: string;
  reason?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  const action = input?.action === "hide" || input?.action === "unhide" || input?.action === "delete" ? input.action : null;
  if (!action || typeof input.reviewId !== "string") return { success: false, error: "Errors.invalidData" };
  const r = await reviewService.moderate({
    reviewId: input.reviewId,
    action,
    reason: typeof input.reason === "string" ? input.reason : null,
    actor: { id: auth.actor.id, ip: await getClientIpOrNull() },
  });
  if (!r.ok) return { success: false, error: ERROR_KEY[r.reason] ?? "Errors.generic" };
  revalidatePathAllLocales("/admin/reviews");
  revalidatePathAllLocales(`/shop/${r.shopId}`);
  return { success: true };
}
