/**
 * İptal politikası — check-in’e kalan süreye göre kademe (Bounce benzeri).
 * Sunucu (`BookingService`) ve istemci (`CancellationPolicy`) aynı kuralları kullanır.
 */

export type CancellationTier = "FULL" | "PARTIAL" | "CREDIT_ONLY";

/** Check-in’den ≥ bu saat kala tam kart iadesi (hizmet + sigorta satırı). */
export const CANCEL_FULL_REFUND_MIN_HOURS = 24;

/** Check-in’den ≥ bu saat kala kısmi kart iadesi; altı “kredi” (kupon). */
export const CANCEL_PARTIAL_REFUND_MIN_HOURS = 1;

/** Kısmi kademede ödenen tutarın kartına iade edilecek oranı (0–1). */
export const CANCEL_PARTIAL_REFUND_FRACTION = 0.5;

/**
 * Check-in zamanına göre iade kademesi.
 * Check-in geçmişse CREDIT_ONLY (nakit iade yok).
 */
export function getCancellationTier(
  checkInTime: Date,
  now: Date = new Date()
): CancellationTier {
  const ms = checkInTime.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return "CREDIT_ONLY";
  }
  const hours = ms / (1000 * 60 * 60);
  if (hours >= CANCEL_FULL_REFUND_MIN_HOURS) return "FULL";
  if (hours >= CANCEL_PARTIAL_REFUND_MIN_HOURS) return "PARTIAL";
  return "CREDIT_ONLY";
}

export function estimatePaidRefundForTier(
  totalPaid: number,
  tier: CancellationTier
): { cardRefund: number; isCreditOnly: boolean } {
  const paid = Math.max(0, totalPaid);
  if (tier === "FULL") {
    return { cardRefund: Math.round(paid * 100) / 100, isCreditOnly: false };
  }
  if (tier === "PARTIAL") {
    const cardRefund =
      Math.round(paid * CANCEL_PARTIAL_REFUND_FRACTION * 100) / 100;
    return { cardRefund, isCreditOnly: false };
  }
  return { cardRefund: 0, isCreditOnly: true };
}
