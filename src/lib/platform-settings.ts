import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { parsePlatformHolidayDates } from "@/lib/booking-holidays";
import {
  DEFAULT_PRICING_RULES,
  type PricingRules,
} from "@/lib/pricing-rules";

let cache: { rules: PricingRules; at: number } | null = null;
const TTL_MS = 60_000;

function mapRow(row: {
  maxStayDays: number;
  maxBagsPerSlot: number;
  insuranceFeeTry: unknown;
  earlyRefundRatio: unknown;
  cancelFixedFeeTry: unknown;
  latePickupFeeTry: unknown;
  latePickupGraceMin: number;
  checkInGraceMin: number;
  requireSealsOnCheckIn: boolean;
  defaultShopCapacity: number;
  defaultPricePerDay: unknown;
  bagMultiplierS: unknown;
  bagMultiplierM: unknown;
  bagMultiplierXl: unknown;
  platformHolidayDates?: unknown;
  platformCommissionRate?: unknown;
}): PricingRules {
  return {
    // Kolon yeni; eski satirlarda null gelirse varsayilana duser.
    platformCommissionRate:
      row.platformCommissionRate == null
        ? DEFAULT_PRICING_RULES.platformCommissionRate
        : moneyToNumber(row.platformCommissionRate),
    maxStayDays: row.maxStayDays,
    maxBagsPerSlot: row.maxBagsPerSlot,
    insuranceFeeTry: moneyToNumber(row.insuranceFeeTry),
    earlyRefundRatio: moneyToNumber(row.earlyRefundRatio),
    cancelFixedFeeTry: moneyToNumber(row.cancelFixedFeeTry),
    latePickupFeeTry: moneyToNumber(row.latePickupFeeTry),
    latePickupGraceMin: row.latePickupGraceMin,
    checkInGraceMin: row.checkInGraceMin,
    requireSealsOnCheckIn: row.requireSealsOnCheckIn,
    defaultShopCapacity: row.defaultShopCapacity,
    defaultPricePerDay: moneyToNumber(row.defaultPricePerDay),
    bagMultipliers: {
      S: moneyToNumber(row.bagMultiplierS),
      M: moneyToNumber(row.bagMultiplierM),
      XL: moneyToNumber(row.bagMultiplierXl),
    },
    platformHolidayDates: parsePlatformHolidayDates(row.platformHolidayDates),
  };
}

/**
 * Platform ayarları (cache’li). Satır yoksa varsayılan kurallar.
 */
export async function getPricingRules(): Promise<PricingRules> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.rules;
  }
  const row = await prisma.platformSettings.findUnique({
    where: { id: "default" },
  });
  const rules: PricingRules = row ? mapRow(row) : { ...DEFAULT_PRICING_RULES };
  cache = { rules, at: Date.now() };
  return rules;
}

export function invalidatePricingRulesCache(): void {
  cache = null;
}
