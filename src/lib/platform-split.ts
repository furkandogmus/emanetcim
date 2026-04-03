/** Esnaf payı (iyzico subMerchantPrice). Kalan platform komisyonu. */
export function computeSubMerchantShare(totalPrice: number): number {
  const rate = Number(process.env.PLATFORM_COMMISSION_RATE ?? 0.5);
  const clamped = Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0.5;
  return Math.round(totalPrice * (1 - clamped) * 100) / 100;
}
