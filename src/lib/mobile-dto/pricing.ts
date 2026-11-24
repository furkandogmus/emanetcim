import { moneyToNumber } from "@/lib/money";
import type { PricingRules } from "@/lib/pricing-rules";
import { applyAppDiscount } from "@/lib/app-discount";

/**
 * Mobil ödeme ekranının TAHMİNİ tutarı hesaplarken kullandığı kurallar.
 *
 * NEDEN (2026-09-23): istemci çarpanları (0.8/1.0/1.5) ve sigortayı (₺15) sabit
 * yazıyordu. Canlıda çarpanlar 1/1/1, sigorta 0 — misafir S için ₺120, XL için
 * ₺225 ve ayrıca ₺15 sigorta görüyor, sunucu ise hepsine ₺150 kesiyordu. Aradaki
 * fark yalnızca geliştirici loguna düşüyordu. Kural sunucuda; istemci onu okur.
 */
/**
 * Liste ve haritada gosterilen gunluk fiyat ARALIGI (en kucuk - en buyuk valiz).
 * `pricePerDay` orta valizin taban fiyati; tek basina "valiz basi ₺250" diye
 * gosterilince kucuk/buyuk valizin farkli fiyati ayni ekranda celisiyordu.
 */
export function toMobilePriceRange(pricePerDay: unknown, r: PricingRules) {
  const base = moneyToNumber(pricePerDay);
  const m = [r.bagMultipliers.S, r.bagMultipliers.M, r.bagMultipliers.XL];
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    min: round(base * Math.min(...m)),
    max: round(base * Math.max(...m)),
    // Liste ve pinde gosterilen tek fiyat: orta boy valizin gunlugu (2026-11-19, aralik
    // kartin yarisini kapliyor ve dukkan adini kesiyordu).
    medium: round(base * r.bagMultipliers.M),
  };
}

/**
 * Tarihli aramada aranan kalis ve valiz karisiminin toplami. Girdi
 * `computeAuthoritativeCheckoutTotals` ciktisi: `checkout/quote`un kodsuz `total`i ile ayni sayi.
 */
export function toMobileStayQuote(totals: {
  subtotalBeforeCoupon: number;
  stayDays: number;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
}) {
  return {
    total: totals.subtotalBeforeCoupon,
    days: totals.stayDays,
    bags: totals.bagCountS + totals.bagCountM + totals.bagCountXl,
  };
}

/**
 * Dukkan detayinda boyut basina gunluk fiyat, sunucunun yuvarlamasiyla. Istemci
 * `pricePerDay * carpan` hesaplamaz (mobile-expo/CLAUDE.md "Fiyat istemcide hesaplanmaz").
 */
export function toMobilePriceBySize(pricePerDay: unknown, r: PricingRules) {
  const base = moneyToNumber(pricePerDay);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    s: round(base * r.bagMultipliers.S),
    m: round(base * r.bagMultipliers.M),
    xl: round(base * r.bagMultipliers.XL),
  };
}

export function toMobilePricing(r: PricingRules) {
  return {
    bagMultiplierS: r.bagMultipliers.S,
    bagMultiplierM: r.bagMultipliers.M,
    bagMultiplierXl: r.bagMultipliers.XL,
    insuranceFeeTry: r.insuranceFeeTry,
  };
}

/** `checkout/quote`: secilen tek indirim ve araci kodu durumu (`CheckoutDiscountService.preview`). */
export function toMobileCheckoutDiscount(q: {
  total: number;
  appDiscount: { pct: number; amount: number } | null;
  discount: { kind: "coupon" | "referral" | "affiliate"; code: string; amount: number } | null;
  codeStatus: string | null;
  minPrice: number | null;
  affiliate: { code: string; status: string; ratePct: number; amount: number } | null;
}) {
  return {
    total: q.total,
    // Yeni alan: eski uygulama yok sayar, `total` zaten indirimli.
    appDiscount: q.appDiscount ? { pct: q.appDiscount.pct, amount: q.appDiscount.amount } : null,
    discount: q.discount ? { kind: q.discount.kind, code: q.discount.code, amount: q.discount.amount } : null,
    codeStatus: q.codeStatus,
    minPrice: q.minPrice,
    affiliate: q.affiliate
      ? { code: q.affiliate.code, status: q.affiliate.status, ratePct: q.affiliate.ratePct, amount: q.affiliate.amount }
      : null,
  };
}

/**
 * Dukkan detayindaki "Uygulama fiyati": boyut basina gunluk fiyatin indirimli hali,
 * `checkout/intent` ile ayni yuvarlama. Oran 0 ise `null` (istemci ustu cizili fiyat gostermez).
 */
export function toMobileAppPrice(pricePerDay: unknown, r: PricingRules) {
  const base = toMobilePriceBySize(pricePerDay, r);
  const pct = applyAppDiscount(base.m, r.appBookingDiscountPct).pct;
  if (pct <= 0) return null;
  return {
    pct,
    priceBySize: {
      s: applyAppDiscount(base.s, pct).totalPrice,
      m: applyAppDiscount(base.m, pct).totalPrice,
      xl: applyAppDiscount(base.xl, pct).totalPrice,
    },
  };
}
