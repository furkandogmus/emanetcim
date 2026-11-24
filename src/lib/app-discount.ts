/**
 * Uygulama kanali indirimi (2026-11-24, sahip karari): mobil uygulamadan yapilan
 * rezervasyona platform geneli yuzde indirim (`PlatformSettings.appBookingDiscountPct`).
 *
 * Kanal istemciden ALINMAZ: yalnizca mobil checkout uclari (`checkout/quote`,
 * `checkout/intent`) `channel: "app"` gecer. Siralama: uygulama indirimi ara
 * toplamdan once dusulur, kupon/davet/araci indirimi kalan tutara uygulanir
 * (`CheckoutDiscountService`). Kural `docs/URUN_VE_IS_KURALLARI.md`.
 */

export type CheckoutChannel = "web" | "app";

/** Yonetici ayarinin gecerli araligi; disindaki deger indirim uretmez. */
export const APP_DISCOUNT_MAX_PCT = 50;

export function normalizeAppDiscountPct(pct: unknown): number {
  if (typeof pct !== "number" || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(APP_DISCOUNT_MAX_PCT, pct);
}

/**
 * Indirim kurusa yuvarlanir (yarim kurus yukari). Kurus tamsayisiyla hesaplanir:
 * `0.1 + 0.2` turu kayan nokta hatasi 225,00 yerine 224,99 uretmesin.
 */
export function applyAppDiscount(
  subtotal: number,
  pct: unknown,
): { pct: number; discountAmount: number; totalPrice: number } {
  const p = normalizeAppDiscountPct(pct);
  const kurus = Math.max(0, Math.round(subtotal * 100));
  const off = p > 0 ? Math.round((kurus * p) / 100) : 0;
  return { pct: p, discountAmount: off / 100, totalPrice: (kurus - off) / 100 };
}

/**
 * Rezervasyonda kilitli indirimlerin toplami: duzenleme ve valiz revizyonu yeni
 * ara toplamdan bunu duser. Uygulama indirimi de kupon gibi olusturma anindaki
 * tutariyla korunur.
 */
export function lockedBookingDiscount(b: {
  couponDiscountAmount?: unknown;
  referralDiscountAmount?: unknown;
  affiliateDiscountAmount?: unknown;
  appDiscountAmount?: unknown;
}): number {
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
  };
  return (
    Math.round(
      (n(b.couponDiscountAmount) + n(b.referralDiscountAmount) + n(b.affiliateDiscountAmount) + n(b.appDiscountAmount)) * 100,
    ) / 100
  );
}
