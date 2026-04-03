/**
 * İş kuralları (fiyat çarpanları, limitler) — DB ile aynı varsayılanlar.
 * `getPricingRules()` bu yapıyı PlatformSettings’ten doldurur.
 */
export type PricingRules = {
  maxStayDays: number;
  maxBagsPerSlot: number;
  insuranceFeeTry: number;
  earlyRefundRatio: number;
  cancelFixedFeeTry: number;
  defaultShopCapacity: number;
  defaultPricePerDay: number;
  bagMultipliers: { S: number; M: number; XL: number };
};

/** Kod/seed ile uyumlu tek kaynak varsayılan (DB satırı yoksa fallback). */
export const DEFAULT_PRICING_RULES: PricingRules = {
  maxStayDays: 30,
  maxBagsPerSlot: 50,
  insuranceFeeTry: 15,
  earlyRefundRatio: 0.9,
  cancelFixedFeeTry: 20,
  defaultShopCapacity: 10,
  defaultPricePerDay: 50,
  bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
};
