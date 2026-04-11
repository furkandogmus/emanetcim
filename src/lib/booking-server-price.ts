import { computeServiceTotalForStay } from "@/lib/bag-pricing";
import type { PricingRules } from "@/lib/pricing-rules";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum depolama süresi (fiyatlandırma ve rezervasyon doğrulaması). */
export const MIN_BOOKING_STAY_MS = 60 * 60 * 1000;

/** Check-in geçmişi toleransı (istemci / sunucu saat kayması). */
export const BOOKING_CHECK_IN_GRACE_MS = 5 * 60 * 1000;

export function clampBagCount(n: unknown, maxBagsPerSlot: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(maxBagsPerSlot, Math.floor(n)));
}

/**
 * Rezervasyon penceresinin iş kurallarına uygunluğu (fiyat hesaplamadan önce).
 */
export function validateBookingStayWindow(
  checkIn: Date,
  checkOut: Date,
  rules: PricingRules = DEFAULT_PRICING_RULES,
  nowMs: number = Date.now()
): boolean {
  if (checkIn.getTime() < nowMs - BOOKING_CHECK_IN_GRACE_MS) return false;
  const ms = checkOut.getTime() - checkIn.getTime();
  if (!Number.isFinite(ms) || ms < MIN_BOOKING_STAY_MS) return false;
  const rawDays = Math.ceil(ms / DAY_MS);
  return rawDays >= 1 && rawDays <= rules.maxStayDays;
}

/**
 * checkIn / checkOut arasındaki faturalanacak gün sayısı (kısmi gün = yukarı yuvarlanır).
 * Önce {@link validateBookingStayWindow} ile doğrulayın.
 */
export function computeStayDaysFromWindow(
  checkIn: Date,
  checkOut: Date,
  rules: PricingRules = DEFAULT_PRICING_RULES
): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  const days = Math.ceil(ms / DAY_MS);
  return Math.max(1, Math.min(rules.maxStayDays, days));
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
  checkOut: Date,
  rules: PricingRules
) {
  const s = clampBagCount(bagCountS, rules.maxBagsPerSlot);
  const m = clampBagCount(bagCountM, rules.maxBagsPerSlot);
  const xl = clampBagCount(bagCountXl, rules.maxBagsPerSlot);
  const days = computeStayDaysFromWindow(checkIn, checkOut, rules);
  const unit = Number.isFinite(pricePerDay) ? pricePerDay : rules.defaultPricePerDay;
  const serviceTotal = computeServiceTotalForStay(unit, s, m, xl, days, rules);
  const insuranceFee = serviceTotal > 0 ? rules.insuranceFeeTry : 0;
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
