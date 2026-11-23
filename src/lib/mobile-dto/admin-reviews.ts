import type { ReviewSource } from "./internal";
import { toMobileReview } from "./review";

type AdminReviewSource = ReviewSource & {
  hiddenAt: Date | null;
  hiddenReason: string | null;
  shop: { id: string; name: string };
};

/**
 * Moderasyon satiri. Misafir yorumundan farki: yonetici misafirin tam adini,
 * dukkani ve gizleme durumunu gorur (`toMobileReview` yalnizca ilk adi verir).
 */
export function toMobileAdminReview(r: AdminReviewSource) {
  return {
    ...toMobileReview(r),
    guestName: r.guest.name?.trim() ?? "",
    shop: { id: r.shop.id, name: r.shop.name },
    hidden: r.hiddenAt !== null,
    hiddenAt: r.hiddenAt?.toISOString() ?? null,
    hiddenReason: r.hiddenReason,
  };
}
