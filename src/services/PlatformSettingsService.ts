import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { writeAuditLog } from "@/lib/audit-log";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";
import { parsePlatformHolidayDates } from "@/lib/booking-holidays";
import { invalidatePricingRulesCache } from "@/lib/platform-settings";
import { invalidateAppVersionGateCache } from "@/lib/app-version";
import { invalidateAppStoreFlagsCache } from "@/lib/app-stores";
import { revalidatePath } from "next/cache";
import {
  compareSemver,
  platformSettingsConfirmPhrase,
  riskyPlatformChanges,
  type RiskyChange,
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
  // Istege bagli: eski mobil surumler bu alanlari gondermez; gelmezse mevcut deger korunur.
  iosAppStoreLive: z.boolean().optional(),
  androidPlayLive: z.boolean().optional(),
})
  /*
    KILITLENME KAPISI: en yeni yayindaki surumun ustunde bir `minAppVersion`
    her kullaniciyi (yonetici dahil) guncelleme ekranina kilitler, Play'de daha
    yeni build yoksa donguden cikis yok. `latestAppVersion` yayindaki en yeni
    ikilidir; min onu asamaz ve latest bosken min konamaz.
  */
  .superRefine((d, ctx) => {
    if (d.minAppVersion === null) return;
    const cmp = d.latestAppVersion === null ? null : compareSemver(d.minAppVersion, d.latestAppVersion);
    if (cmp === null || cmp > 0) {
      ctx.addIssue({ code: "custom", path: ["minAppVersion"], message: VERSION_GATE_ISSUE });
    }
  });

const VERSION_GATE_ISSUE = "min_above_latest";

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
  iosAppStoreLive: boolean;
  androidPlayLive: boolean;
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
        iosAppStoreLive: false,
        androidPlayLive: false,
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
      iosAppStoreLive: row.iosAppStoreLive,
      androidPlayLive: row.androidPlayLive,
    },
  };
}

export type PlatformSettingsActor = { id: string; role: string };

export type UpdatePlatformSettingsResult =
  | { ok: true }
  | { ok: false; reason: "invalid_data" | "invalid_version_gate" | "stale_settings" }
  | { ok: false; reason: "confirmation_required"; changes: RiskyChange[]; phrase: string };

/**
 * Mobil uc iki kapi acar, web formu ikisini de tasimiyor (davranisi degismedi):
 * - `requireConfirmation`: riskli degisiklikte `confirmation` = `platformSettingsConfirmPhrase`.
 * - `expectedUpdatedAt` (verilirse; `null` = hic kaydedilmemis): arada baskasi
 *   kaydettiyse `stale_settings`. Yazma kosullu: okuma ile yazma arasindaki yarisi da yakalar.
 */
export async function updatePlatformSettings(
  actor: PlatformSettingsActor,
  data: unknown,
  opts: {
    ip?: string | null;
    requireConfirmation?: boolean;
    confirmation?: unknown;
    expectedUpdatedAt?: string | null;
  } = {},
): Promise<UpdatePlatformSettingsResult> {
  const parsed = platformSettingsUpdateSchema.safeParse(data);
  if (!parsed.success) {
    const gate = parsed.error.issues.some((i) => i.message === VERSION_GATE_ISSUE);
    return { ok: false, reason: gate ? "invalid_version_gate" : "invalid_data" };
  }
  const d = parsed.data;

  const snapshot = await getPlatformSettingsForAdmin();
  const versioned = opts.expectedUpdatedAt !== undefined;
  if (versioned && (snapshot.updatedAt?.toISOString() ?? null) !== opts.expectedUpdatedAt) {
    return { ok: false, reason: "stale_settings" };
  }
  const changes = riskyPlatformChanges(snapshot.values, d);
  const phrase = platformSettingsConfirmPhrase(changes);
  if (opts.requireConfirmation && changes.length > 0 && opts.confirmation !== phrase) {
    return { ok: false, reason: "confirmation_required", changes, phrase };
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
    iosAppStoreLive: d.iosAppStoreLive ?? snapshot.values.iosAppStoreLive,
    androidPlayLive: d.androidPlayLive ?? snapshot.values.androidPlayLive,
  };
  if (!versioned) {
    await prisma.platformSettings.upsert({ where: { id: "default" }, create: { id: "default", ...fields }, update: fields });
  } else if (snapshot.updatedAt) {
    const res = await prisma.platformSettings.updateMany({
      where: { id: "default", updatedAt: snapshot.updatedAt },
      data: fields,
    });
    if (res.count === 0) return { ok: false, reason: "stale_settings" };
  } else {
    try {
      await prisma.platformSettings.create({ data: { id: "default", ...fields } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: false, reason: "stale_settings" };
      }
      throw err;
    }
  }
  invalidatePricingRulesCache();
  invalidateAppVersionGateCache();
  invalidateAppStoreFlagsCache();
  const storeFlagsChanged =
    fields.iosAppStoreLive !== snapshot.values.iosAppStoreLive ||
    fields.androidPlayLive !== snapshot.values.androidPlayLive;
  if (storeFlagsChanged) revalidateStorePromotionPages();
  writeAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "platform_settings.update",
    entityType: "PlatformSettings",
    entityId: "default",
    metadata: {
      riskyChanged: changes.map((c) => c.field),
      ...(storeFlagsChanged
        ? { storeFlags: { iosAppStoreLive: fields.iosAppStoreLive, androidPlayLive: fields.androidPlayLive } }
        : {}),
    },
    ip: opts.ip ?? null,
  });
  return { ok: true };
}

/**
 * Magaza bayragi degisti: statik uretilmis sayfalar (kok layout'taki Safari
 * bandi meta'si, ana sayfa rozetleri) eski bayrakla kalmasin. Istek baglami
 * disinda (test, betik) `revalidatePath` firlatir; o durumda yapacak is yok.
 */
function revalidateStorePromotionPages(): void {
  try {
    revalidatePath("/[locale]", "layout");
  } catch {
    /* istek baglami yok */
  }
}
