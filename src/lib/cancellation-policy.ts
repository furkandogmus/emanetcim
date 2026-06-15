/**
 * İptal politikası — Bounce model: free cancellation before drop-off.
 * <1h before → credits only. No fees, no tiers.
 */
export type CancellationTier = "FULL" | "CREDIT_ONLY";

export const CANCEL_CREDIT_ONLY_MINUTES = 60;

export function getCancellationTier(
  checkInTime: Date,
  now: Date = new Date()
): CancellationTier {
  const ms = checkInTime.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return "CREDIT_ONLY";
  }
  const minutes = ms / (1000 * 60);
  if (minutes >= CANCEL_CREDIT_ONLY_MINUTES) return "FULL";
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
  return { cardRefund: 0, isCreditOnly: true };
}
