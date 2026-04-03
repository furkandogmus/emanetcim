import {
  DEFAULT_PRICING_RULES,
  type PricingRules,
} from "@/lib/pricing-rules";

export type { PricingRules };

/**
 * Merkezi valiz fiyat çarpanları — `PricingRules` ile DB ayarlarından beslenir.
 */
export function roundedSlotPrices(
  pricePerDay: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
) {
  const base = Number.isFinite(pricePerDay)
    ? pricePerDay
    : rules.defaultPricePerDay;
  const m = rules.bagMultipliers;
  return {
    s: Math.round(base * m.S),
    m: Math.round(base * m.M),
    xl: Math.round(base * m.XL),
  };
}

/** Bir günlük hizmet satırı (sigorta hariç), checkout ile aynı yuvarlama. */
export function computeDailyBagLineTotal(
  pricePerDay: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
): number {
  const p = roundedSlotPrices(pricePerDay, rules);
  return bagCountS * p.s + bagCountM * p.m + bagCountXl * p.xl;
}

export function totalBagCount(
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number
): number {
  return bagCountS + bagCountM + bagCountXl;
}

/** Günlük hizmet satırı × gün sayısı (checkout ile aynı yuvarlama). */
export function computeServiceTotalForStay(
  pricePerDay: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  numberOfDays: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
): number {
  const daily = computeDailyBagLineTotal(
    pricePerDay,
    bagCountS,
    bagCountM,
    bagCountXl,
    rules
  );
  const days = Math.max(
    1,
    Math.min(rules.maxStayDays, Math.floor(numberOfDays))
  );
  return Math.round(daily * days * 100) / 100;
}

/** Geriye dönük uyumluluk (test / sabit referans). */
export const MAX_STAY_DAYS = DEFAULT_PRICING_RULES.maxStayDays;
