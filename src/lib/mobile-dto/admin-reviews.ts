import type { ReviewSource } from "./internal";
import { toMobileReview } from "./review";

type AdminReviewSource = ReviewSource & {
  hiddenAt: Date | null;
  hiddenReason: string | null;
  shop: { id: string; name: string };
  openReportCount?: number;
  reports?: { reason: string; note: string | null }[];
};

/** `ReviewService.AUTO_HIDE_REASON`; dto servisi ithal etmesin diye burada da yazili. */
const AUTO_HIDE_REASON = "auto:reports";

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
    // Otomatik gizlemenin isareti gerekce olarak gosterilmez; `autoHidden` ayri tasir.
    hiddenReason: r.hiddenReason === AUTO_HIDE_REASON ? null : r.hiddenReason,
    autoHidden: r.hiddenReason === AUTO_HIDE_REASON,
    openReportCount: r.openReportCount ?? 0,
    reports: (r.reports ?? []).map((x) => ({ reason: x.reason, note: x.note })),
  };
}
