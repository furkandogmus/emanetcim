import type { ReviewReportReason, ShopReview } from "./review";

export type AdminReviewFilter = "reported" | "all" | "low" | "hidden";

/** `toMobileAdminReview`: gizlenenler dahil, misafirin tam adi ve dukkanla. */
export type AdminReview = ShopReview & {
  guestName: string;
  shop: { id: string; name: string };
  hidden: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  /** Esik sayida bildirimle otomatik gizlendi; yonetici karari bekliyor. */
  autoHidden: boolean;
  /** Cozulmemis bildirim sayisi; kuyruk buna gore siralanir. */
  openReportCount: number;
  reports: { reason: ReviewReportReason; note: string | null }[];
};

export type AdminReviewsPage = { items: AdminReview[]; total: number; nextCursor: string | null };

export type ReviewModerationAction = "hide" | "unhide" | "delete";
