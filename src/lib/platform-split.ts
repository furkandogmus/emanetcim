function clampCommissionRate(): number {
  const rate = Number(process.env.PLATFORM_COMMISSION_RATE ?? 0.5);
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0.5;
}

/** Esnaf payı. Kalan tutar platform komisyonudur. */
export function computeSubMerchantShare(totalPrice: number): number {
  const clamped = clampCommissionRate();
  return Math.round(totalPrice * (1 - clamped) * 100) / 100;
}

/** Esnafın brüt tutardan aldığı oran (1 - platform komisyonu). UI / Partner paneli için. */
export function getMerchantShareRatio(): number {
  return 1 - clampCommissionRate();
}
