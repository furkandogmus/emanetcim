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
  /** YYYY-MM-DD — bu günlere denk gelen konaklama pencereleri reddedilir. */
  platformHolidayDates: string[];
};

/** Kod/seed ile uyumlu tek kaynak varsayılan (DB satırı yoksa fallback). */
export const DEFAULT_PRICING_RULES: PricingRules = {
  maxStayDays: 30,
  maxBagsPerSlot: 50,
  insuranceFeeTry: 0,
  earlyRefundRatio: 1.0,
  cancelFixedFeeTry: 0,
  defaultShopCapacity: 10,
  defaultPricePerDay: 50,
  bagMultipliers: { S: 1.0, M: 1.0, XL: 1.0 },
  platformHolidayDates: [],
};
