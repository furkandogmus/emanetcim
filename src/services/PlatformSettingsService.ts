import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { writeAuditLog } from "@/lib/audit-log";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";
import { parsePlatformHolidayDates } from "@/lib/booking-holidays";
import { invalidatePricingRulesCache } from "@/lib/platform-settings";
import { invalidateAppVersionGateCache } from "@/lib/app-version";
import {
  PLATFORM_SETTINGS_CONFIRM_PHRASE,
  changedRiskyPlatformFields,
  type RiskyPlatformSettingField,
} from "@/lib/admin-risky-settings";

/**
 * Platform ayarlari — web `/admin/platform-settings` ve mobil yonetici ucunun
 * ORTAK govdesi (sema, yazma, onbellek temizligi, denetim kaydi).
 */

/** Bos metin = kapi kapali (`null`); doluysa `x.y.z` semver zorunlu. */
const semverOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+\.\d+\.\d+$/.test(v), { message: "semver_gerekli" })
  .transform((v) => (v === "" ? null : v));

export const platformSettingsUpdateSchema = z.object({
  maxStayDays: z.number().int().min(1).max(365),
  maxBagsPerSlot: z.number().int().min(1).max(5000),
  insuranceFeeTry: z.number().min(0).max(999_999),
  earlyRefundRatio: z.number().min(0).max(1),
  cancelFixedFeeTry: z.number().min(0).max(999_999),
  latePickupFeeTry: z.number().min(0).max(999_999),
  latePickupGraceMin: z.number().int().min(0).max(1440),
  checkInGraceMin: z.number().int().min(0).max(240),
  requireSealsOnCheckIn: z.boolean(),
  defaultShopCapacity: z.number().int().min(1).max(50_000),
  defaultPricePerDay: z.number().min(0).max(999_999),
  bagMultiplierS: z.number().min(0).max(20),
  bagMultiplierM: z.number().min(0).max(20),
  bagMultiplierXl: z.number().min(0).max(20),
  platformHolidayDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .max(366)
    .default([]),
  minAppVersion: semverOrEmpty,
  latestAppVersion: semverOrEmpty,
});

export type PlatformSettingsValues = {
  maxStayDays: number;
  maxBagsPerSlot: number;
  insuranceFeeTry: number;
  earlyRefundRatio: number;
  cancelFixedFeeTry: number;
  latePickupFeeTry: number;
  latePickupGraceMin: number;
  checkInGraceMin: number;
  requireSealsOnCheckIn: boolean;
  defaultShopCapacity: number;
  defaultPricePerDay: number;
  bagMultiplierS: number;
  bagMultiplierM: number;
  bagMultiplierXl: number;
  platformHolidayDates: string[];
  minAppVersion: string | null;
  latestAppVersion: string | null;
};

/** Yonetici ekranlarinin gosterdigi degerler; satir yoksa varsayilan kurallar. */
export async function getPlatformSettingsForAdmin(): Promise<{
  values: PlatformSettingsValues;
  updatedAt: Date | null;
}> {
  const row = await prisma.platformSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    const d = DEFAULT_PRICING_RULES;
    return {
      updatedAt: null,
      values: {
        maxStayDays: d.maxStayDays,
        maxBagsPerSlot: d.maxBagsPerSlot,
        insuranceFeeTry: d.insuranceFeeTry,
        earlyRefundRatio: d.earlyRefundRatio,
        cancelFixedFeeTry: d.cancelFixedFeeTry,
        latePickupFeeTry: d.latePickupFeeTry,
        latePickupGraceMin: d.latePickupGraceMin,
        checkInGraceMin: d.checkInGraceMin,
        requireSealsOnCheckIn: d.requireSealsOnCheckIn,
        defaultShopCapacity: d.defaultShopCapacity,
        defaultPricePerDay: d.defaultPricePerDay,
        bagMultiplierS: d.bagMultipliers.S,
        bagMultiplierM: d.bagMultipliers.M,
        bagMultiplierXl: d.bagMultipliers.XL,
        platformHolidayDates: [],
        minAppVersion: null,
        latestAppVersion: null,
      },
    };
  }
  return {
    updatedAt: row.updatedAt,
    values: {
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
      bagMultiplierS: moneyToNumber(row.bagMultiplierS),
      bagMultiplierM: moneyToNumber(row.bagMultiplierM),
      bagMultiplierXl: moneyToNumber(row.bagMultiplierXl),
      platformHolidayDates: parsePlatformHolidayDates(row.platformHolidayDates),
      minAppVersion: row.minAppVersion,
      latestAppVersion: row.latestAppVersion,
    },
  };
}

export type PlatformSettingsActor = { id: string; role: string };

export type UpdatePlatformSettingsResult =
  | { ok: true }
  | { ok: false; reason: "invalid_data" }
  | { ok: false; reason: "confirmation_required"; fields: RiskyPlatformSettingField[] };

/**
 * `requireConfirmation`: mobil ucu acar. Riskli bir alan DEGISIYORSA
 * `confirmation` tam olarak `PLATFORM_SETTINGS_CONFIRM_PHRASE` olmali.
 * Web formu bu adimi tasimiyor; davranisi degismesin diye kapali.
 */
export async function updatePlatformSettings(
  actor: PlatformSettingsActor,
  data: unknown,
  opts: { ip?: string | null; requireConfirmation?: boolean; confirmation?: unknown } = {},
): Promise<UpdatePlatformSettingsResult> {
  const parsed = platformSettingsUpdateSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "invalid_data" };
  const d = parsed.data;

  const current = (await getPlatformSettingsForAdmin()).values;
  const riskyChanged = changedRiskyPlatformFields(current, d);
  if (opts.requireConfirmation && riskyChanged.length > 0 && opts.confirmation !== PLATFORM_SETTINGS_CONFIRM_PHRASE) {
    return { ok: false, reason: "confirmation_required", fields: riskyChanged };
  }

  const holidayJson = d.platformHolidayDates.length > 0 ? d.platformHolidayDates : Prisma.JsonNull;
  const fields = {
    maxStayDays: d.maxStayDays,
    maxBagsPerSlot: d.maxBagsPerSlot,
    insuranceFeeTry: new Prisma.Decimal(d.insuranceFeeTry),
    earlyRefundRatio: new Prisma.Decimal(d.earlyRefundRatio),
    cancelFixedFeeTry: new Prisma.Decimal(d.cancelFixedFeeTry),
    latePickupFeeTry: new Prisma.Decimal(d.latePickupFeeTry),
    latePickupGraceMin: d.latePickupGraceMin,
    checkInGraceMin: d.checkInGraceMin,
    requireSealsOnCheckIn: d.requireSealsOnCheckIn,
    defaultShopCapacity: d.defaultShopCapacity,
    defaultPricePerDay: new Prisma.Decimal(d.defaultPricePerDay),
    bagMultiplierS: new Prisma.Decimal(d.bagMultiplierS),
    bagMultiplierM: new Prisma.Decimal(d.bagMultiplierM),
    bagMultiplierXl: new Prisma.Decimal(d.bagMultiplierXl),
    platformHolidayDates: holidayJson,
    minAppVersion: d.minAppVersion,
    latestAppVersion: d.latestAppVersion,
  };
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...fields },
    update: fields,
  });
  invalidatePricingRulesCache();
  invalidateAppVersionGateCache();
  writeAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "platform_settings.update",
    entityType: "PlatformSettings",
    entityId: "default",
    metadata: { riskyChanged },
    ip: opts.ip ?? null,
  });
  return { ok: true };
}
