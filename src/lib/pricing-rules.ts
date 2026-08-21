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
  // 2026-08-21: S/XL test dosyasindaki (bag-pricing.test.ts) beklentiyle hizalandi
  // (0.8/1.5) — hepsi 1.0 olmasi boy bazli fiyat farklilastirmasinin hic calismadigi
  // anlamina geliyordu. NOT: bu SADECE PlatformSettings'te "default" satiri yoksa
  // devreye giren kod fallback'i — Hetzner/AWS'deki GERCEK satir hala 1.0/1.0/1.0
  // (canli fiyatlandirma degismedi). O satiri degistirmek /admin/platform-settings
  // uzerinden bilinçli bir is karari olarak yapilmali.
  bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
  platformHolidayDates: [],
};
