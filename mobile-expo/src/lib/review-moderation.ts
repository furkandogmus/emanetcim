import type { ReviewModerationAction } from "./types";

/** Sunucudaki `admin/reviews/:id/:action` alt siniri ile ayni; son karar sunucunun. */
export const MIN_MODERATION_REASON = 3;
export const MAX_MODERATION_REASON = 300;

/** Gizleme ve silme gerekce ister (silme geri alinamaz, izi denetim kaydinda kalir). */
export function needsReason(action: ReviewModerationAction): boolean {
  return action !== "unhide";
}

export function canSubmitModeration(action: ReviewModerationAction, reason: string): boolean {
  if (!needsReason(action)) return true;
  const n = reason.trim().length;
  return n >= MIN_MODERATION_REASON && n <= MAX_MODERATION_REASON;
}

/**
 * Yonetici icerik yazmalari (fotograf, saat, yorum) goruntuleme oturumunda kapali;
 * sunucu da `not_allowed_while_impersonating` ile reddeder.
 */
export function canEditAdminContent(impersonating: unknown): boolean {
  return impersonating === null || impersonating === undefined;
}
