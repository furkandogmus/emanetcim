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

/**
 * Hakedişe SAYILAN rezervasyon durumları — tek doğru kaynak.
 *
 * Neden burada: partner ana paneli ile kazanç sayfası bu kümeyi ayrı ayrı, farklı
 * tanımlarla hesaplıyordu. Ana panel "CANCELLED olmayan her şey" diyordu ve bu yüzden
 * henüz ÖDENMEMİŞ (APPROVED / WAITING_APPROVAL / PENDING) rezervasyonları da kazanç
 * sayıyordu; kazanç sayfası ise yalnızca ödenmiş/teslim alınmış olanları sayıyordu.
 * Sonuç: aynı dükkan için iki ekranda iki farklı "NET HAKEDİŞ" (2026-08-22'de canlıda
 * 710 TL ve 490 TL olarak görüldü — brüt 1420 ve 980). Esnaf ne kadar alacağı olduğunu
 * bilemiyordu.
 *
 * Doğru tanım ödenmiş olandır: onaylanmış ama parası alınmamış bir rezervasyon
 * hakediş değildir.
 */
export const EARNING_BOOKING_STATUSES = [
  "PAID",
  "CHECKED_IN",
  "CHECKED_OUT",
] as const;

/** Bir rezervasyon durumu hakedişe sayılıyor mu? */
export function countsTowardEarnings(status: string): boolean {
  return (EARNING_BOOKING_STATUSES as readonly string[]).includes(status);
}
