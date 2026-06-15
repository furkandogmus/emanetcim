import {
  DEFAULT_PRICING_RULES,
  type PricingRules,
} from "@/lib/pricing-rules";

export type { PricingRules };

/**
 * Merkezi valiz fiyat çarpanları — `PricingRules` ile DB ayarlarından beslenir.
 */
export function preciseSlotPrices(
  pricePerDay: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
) {
  const base = Number.isFinite(pricePerDay)
    ? pricePerDay
    : rules.defaultPricePerDay;
  const m = rules.bagMultipliers;
  // BUG-19: Ara yuvarlama kaldırıldı, hassasiyet korunuyor.
  return {
    s: base * m.S,
    m: base * m.M,
    xl: base * m.XL,
  };
}

/** UI bileşenleri için tam sayıya yuvarlanmış fiyatlar. */
export function roundedSlotPrices(
  pricePerDay: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
) {
  const p = preciseSlotPrices(pricePerDay, rules);
  return {
    s: Math.round(p.s),
    m: Math.round(p.m),
    xl: Math.round(p.xl),
  };
}

/** Bir günlük hizmet satırı (sigorta hariç). */
export function computeDailyBagLineTotal(
  pricePerDay: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
): number {
  const p = preciseSlotPrices(pricePerDay, rules);
  return bagCountS * p.s + bagCountM * p.m + bagCountXl * p.xl;
}

export function totalBagCount(
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number
): number {
  return bagCountS + bagCountM + bagCountXl;
}

/** Günlük hizmet satırı × gün sayısı. Tam gün kuralı (ceil) uygulanır. */
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
  // BUG-19: Her zaman yukarı yuvarla (1.1 gün = 2 gün)
  const days = Math.max(
    1,
    Math.min(rules.maxStayDays, Math.ceil(numberOfDays))
  );
  return Math.round(daily * days * 100) / 100;
}

/** Geriye dönük uyumluluk (test / sabit referans). */
export const MAX_STAY_DAYS = DEFAULT_PRICING_RULES.maxStayDays;

/**
 * Hourly/slot-based pricing.
 * slotCount: number of 30-minute slots booked
 * pricePerHour: shop's hourly rate
 */
export function computeHourlyLineTotal(
  pricePerHour: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  rules: PricingRules = DEFAULT_PRICING_RULES,
): number {
  const m = rules.bagMultipliers;
  return pricePerHour * (bagCountS * m.S + bagCountM * m.M + bagCountXl * m.XL);
}

/**
 * Service total for slot-based bookings.
 * hours = slotCount / 2 (each slot = 30 min)
 */
export function computeSlotBasedTotal(
  pricePerHour: number,
  slotCount: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  rules: PricingRules = DEFAULT_PRICING_RULES,
): number {
  const hours = slotCount * 0.5;
  const hourly = computeHourlyLineTotal(pricePerHour, bagCountS, bagCountM, bagCountXl, rules);
  return Math.round(hours * hourly * 100) / 100;
}

/**
 * Mixed: uses pricePerHour for slot-based pricing with daily pricePerDay fallback.
 */
export function computeServiceTotalForSlots(
  pricePerDay: number,
  pricePerHour: number | null,
  slotCount: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  rules: PricingRules = DEFAULT_PRICING_RULES,
): number {
  if (pricePerHour != null && pricePerHour > 0) {
    return computeSlotBasedTotal(pricePerHour, slotCount, bagCountS, bagCountM, bagCountXl, rules);
  }
  const days = Math.max(1, Math.min(rules.maxStayDays, Math.ceil(slotCount / 48)));
  return computeServiceTotalForStay(pricePerDay, bagCountS, bagCountM, bagCountXl, days, rules);
}
