import { computeServiceTotalForStay, MAX_STAY_DAYS } from "@/lib/bag-pricing";

const MAX_BAGS_PER_SLOT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

/** CheckoutClient ile aynı: sigorta sabit ₺15, hizmet 0 ise sigorta yok. */
export const INSURANCE_FEE_TRY = 15;

export function clampBagCount(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_BAGS_PER_SLOT, Math.floor(n)));
}

/**
 * checkIn / checkOut arasındaki gün sayısı (checkout ile uyumlu, max MAX_STAY_DAYS).
 */
export function computeStayDaysFromWindow(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  const days = Math.round(ms / DAY_MS);
  return Math.max(1, Math.min(MAX_STAY_DAYS, days));
}

/**
 * Sunucu tarafı tek doğruluk kaynağı: dükkan fiyatı + çanta + konaklama günü + sigorta.
 * İstemciden gelen totalPrice / unitPrice / insuranceFee güvenilmez.
 */
export function computeAuthoritativeCheckoutTotals(
  pricePerDay: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  checkIn: Date,
  checkOut: Date
) {
  const s = clampBagCount(bagCountS);
  const m = clampBagCount(bagCountM);
  const xl = clampBagCount(bagCountXl);
  const days = computeStayDaysFromWindow(checkIn, checkOut);
  const unit = Number.isFinite(pricePerDay) ? pricePerDay : 50;
  const serviceTotal = computeServiceTotalForStay(unit, s, m, xl, days);
  const insuranceFee = serviceTotal > 0 ? INSURANCE_FEE_TRY : 0;
  const subtotalBeforeCoupon =
    Math.round((serviceTotal + insuranceFee) * 100) / 100;

  return {
    bagCountS: s,
    bagCountM: m,
    bagCountXl: xl,
    stayDays: days,
    unitPrice: unit,
    serviceTotal,
    insuranceFee,
    subtotalBeforeCoupon,
  };
}
