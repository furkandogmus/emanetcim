/**
 * Merkezi valiz fiyat çarpanları — CheckoutClient ve PricingService ile aynı kurallar.
 */
export const BAG_MULTIPLIERS = { S: 0.8, M: 1.0, XL: 1.5 } as const;

export function roundedSlotPrices(pricePerDay: number) {
  const base = Number.isFinite(pricePerDay) ? pricePerDay : 50;
  return {
    s: Math.round(base * BAG_MULTIPLIERS.S),
    m: Math.round(base * BAG_MULTIPLIERS.M),
    xl: Math.round(base * BAG_MULTIPLIERS.XL),
  };
}

/** Bir günlük hizmet satırı (sigorta hariç), checkout ile aynı yuvarlama. */
export function computeDailyBagLineTotal(
  pricePerDay: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number
): number {
  const p = roundedSlotPrices(pricePerDay);
  return (
    bagCountS * p.s + bagCountM * p.m + bagCountXl * p.xl
  );
}

export function totalBagCount(
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number
): number {
  return bagCountS + bagCountM + bagCountXl;
}

const MAX_STAY_DAYS = 30;

/** Günlük hizmet satırı × gün sayısı (checkout ile aynı yuvarlama). */
export function computeServiceTotalForStay(
  pricePerDay: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  numberOfDays: number
): number {
  const daily = computeDailyBagLineTotal(
    pricePerDay,
    bagCountS,
    bagCountM,
    bagCountXl
  );
  const days = Math.max(
    1,
    Math.min(MAX_STAY_DAYS, Math.floor(numberOfDays))
  );
  return Math.round(daily * days * 100) / 100;
}

export { MAX_STAY_DAYS };
