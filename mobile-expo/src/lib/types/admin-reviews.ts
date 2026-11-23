import type { ShopReview } from "./review";

export type AdminReviewFilter = "all" | "low" | "hidden";

/** `toMobileAdminReview`: gizlenenler dahil, misafirin tam adi ve dukkanla. */
export type AdminReview = ShopReview & {
  guestName: string;
  shop: { id: string; name: string };
  hidden: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
};

export type AdminReviewsPage = { items: AdminReview[]; total: number; nextCursor: string | null };

export type ReviewModerationAction = "hide" | "unhide" | "delete";
