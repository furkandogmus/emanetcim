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
  /** Geç teslim alma ücreti. `cancelFixedFeeTry`'dan BAĞIMSIZ — bkz. DEFAULT_PRICING_RULES notu. */
  latePickupFeeTry: number;
  /** Gecikme ücreti işlemeden önceki tolerans (dakika). */
  latePickupGraceMin: number;
  defaultShopCapacity: number;
  defaultPricePerDay: number;
  bagMultipliers: { S: number; M: number; XL: number };
  /** YYYY-MM-DD — bu günlere denk gelen konaklama pencereleri reddedilir. */
  platformHolidayDates: string[];
};

/**
 * Varsayılan iş kuralları — `prisma/schema.prisma` → `PlatformSettings` içindeki
 * `@default` değerleriyle AYNI OLMAK ZORUNDA.
 *
 * NEDEN BU KADAR KESİN: 2026-08-22'de üç ayrı doğruluk kaynağı vardı — şema
 * 1.0/1.0/1.0, bu dosya 0.8/1.0/1.5, prod'daki canlı satır 1.0/1.0/1.0. Buradaki
 * değer yalnızca DB satırı YOKKEN devreye girdiği için, prod'da satır her zaman
 * var olduğundan hiç çalışmıyordu. Sonuç: birisi boy bazlı fiyatlandırmayı
 * "düzelttiğini" sanarken XL bavul hâlâ küçük bavul fiyatı ödüyordu (P0-3).
 *
 * `src/__tests__/pricing-defaults.test.ts` bu dosya ile şemanın ayrışmasını CI'da
 * kırmızı yakar. Buradaki bir değeri değiştiriyorsan şemayı da değiştir.
 *
 * DİKKAT — bu değerler CANLI FİYATI DEĞİŞTİRMEZ. Prod'daki "default" satırı
 * ayrıdır ve yalnızca /admin/platform-settings üzerinden, bilinçli bir iş kararı
 * olarak değişir. Bir migrasyonun canlı fiyatı sessizce değiştirmesi kabul edilmez.
 */
export const DEFAULT_PRICING_RULES: PricingRules = {
  maxStayDays: 30,
  maxBagsPerSlot: 50,
  insuranceFeeTry: 0,
  earlyRefundRatio: 1.0,
  cancelFixedFeeTry: 0,
  latePickupFeeTry: 0,
  latePickupGraceMin: 15,
  defaultShopCapacity: 10,
  defaultPricePerDay: 50,
  bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
  platformHolidayDates: [],
};
