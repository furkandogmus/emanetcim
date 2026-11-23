"use server";

import { requireUser } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { REVIEW_REPORT_REASONS, reviewService } from "@/services/ReviewService";

type Result = { success: true } | { success: false; error: string };

const ERROR_KEY: Record<string, string> = {
  not_found: "Errors.notFound",
  own_review: "Errors.reviewReportOwn",
  duplicate: "Errors.reviewReportDuplicate",
  rate_limited: "Errors.reviewReportRateLimited",
};

/** Yorum bildir (App Review 1.2). Mobil `reviews/:id/report` ile ayni servis. */
export async function reportReviewAction(input: { reviewId: string; reason: string; note?: string }): Promise<Result> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };
  const reason = REVIEW_REPORT_REASONS.find((r) => r === input?.reason);
  if (!reason || typeof input.reviewId !== "string") return { success: false, error: "Errors.invalidData" };
  const r = await reviewService.report({
    reviewId: input.reviewId,
    reporterId: auth.actor.id,
    reason,
    note: typeof input.note === "string" ? input.note : null,
  });
  if (!r.ok) return { success: false, error: ERROR_KEY[r.reason] ?? "Errors.generic" };
  if (r.autoHidden) revalidatePathAllLocales("/search");
  return { success: true };
}

/** "Bu kullanicinin yorumlarini gizle". Mobil `reviews/:id/block` ile ayni servis. */
export async function blockReviewAuthorAction(reviewId: string): Promise<Result> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };
  if (typeof reviewId !== "string") return { success: false, error: "Errors.invalidData" };
  const r = await reviewService.blockAuthor({ reviewId, viewerId: auth.actor.id });
  if (!r.ok) return { success: false, error: ERROR_KEY[r.reason] ?? "Errors.generic" };
  return { success: true };
}
