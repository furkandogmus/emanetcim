import { ApiError, isImpersonating } from "./api";
import { errorMessage } from "./errors";
import i18n from "./i18n";
import type { AdminDisputeStatus, AdminFeatureFlag, AdminPlatformSettingsValues, SettingsConfirmChallenge } from "./types";

/**
 * Yonetim araclari (uyusmazlik, kupon, odeme, ayar, bayrak) icin istemci kurallari.
 * Dogrulamanin asli sunucuda (`../src/services/*`); burada yalniz dugmeyi acip
 * kapatan ve onay penceresini isteyen kisim var.
 */

export const DISPUTE_STATUSES: AdminDisputeStatus[] = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];

/** Goruntuleme oturumunda yazma yok; sunucu da 403 not_allowed_while_impersonating doner. */
export function canMutateAdminOps(): boolean {
  return !isImpersonating();
}

/** Sunucu hata kodu -> `adminOps.errors.*`; bilinmeyen kod genel metne duser. */
export function adminOpsErrorMessage(err: unknown): string {
  return errorMessage(err, "adminOps");
}

/** Sunucu web ile ayni siniri uygular (`DISPUTE_ADMIN_NOTE_MAX`). */
export const DISPUTE_NOTE_MAX = 2000;

/**
 * Ayar PUT'unun 428 yaniti -> onay penceresi. Hangi degisikligin riskli oldugu ve ifade
 * (surum degisiyorsa YENI surumun kendisi) sunucudan gelir; istemci liste tutmaz.
 */
export function settingsConfirmChallenge(err: unknown): SettingsConfirmChallenge | null {
  if (!(err instanceof ApiError) || err.code !== "confirmation_required") return null;
  const body = err.body as Partial<SettingsConfirmChallenge> | undefined;
  if (typeof body?.phrase !== "string" || !Array.isArray(body.changes)) return null;
  return { phrase: body.phrase, changes: body.changes };
}

/** Onay penceresindeki eski/yeni deger: bos "—", acik/kapali cevrilir, liste virgulle. */
export function formatSettingValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return i18n.t(v ? "adminOps.settings.on" : "adminOps.settings.off");
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

/* ---------- kupon ---------- */

export type CouponForm = {
  code: string;
  discount: string;
  isPercent: boolean;
  minPrice: string;
  maxUses: string;
  /** `YYYY-MM-DD`, bos = suresiz. Gun sonu (23:59:59 Istanbul) olarak gonderilir. */
  expiresOn: string;
};

export const EMPTY_COUPON_FORM: CouponForm = {
  code: "",
  discount: "",
  isPercent: true,
  minPrice: "",
  maxUses: "",
  expiresOn: "",
};

const CODE_RE = /^[A-Za-z0-9_-]{3,32}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Sunucu semasi (`adminCouponInputSchema`) ile ayni sinirlar; uyusmazsa sunucu yine reddeder. */
export function couponFormIssues(f: CouponForm): (keyof CouponForm)[] {
  const out: (keyof CouponForm)[] = [];
  if (!CODE_RE.test(f.code.trim())) out.push("code");
  const d = num(f.discount);
  if (d === null || Number.isNaN(d) || d <= 0 || d > 100_000 || (f.isPercent && d > 100)) out.push("discount");
  const m = num(f.minPrice);
  if (m !== null && (Number.isNaN(m) || m < 0 || m > 1_000_000)) out.push("minPrice");
  const u = num(f.maxUses);
  if (u !== null && (Number.isNaN(u) || !Number.isInteger(u) || u < 1 || u > 1_000_000)) out.push("maxUses");
  if (f.expiresOn.trim() && (!DATE_RE.test(f.expiresOn.trim()) || Number.isNaN(Date.parse(`${f.expiresOn.trim()}T00:00:00Z`)))) {
    out.push("expiresOn");
  }
  return out;
}

export function couponBody(f: CouponForm) {
  const exp = f.expiresOn.trim();
  return {
    code: f.code.trim(),
    discount: num(f.discount),
    isPercent: f.isPercent,
    minPrice: num(f.minPrice),
    maxUses: num(f.maxUses),
    // Istanbul UTC+3 (yaz saati yok): gun sonu 20:59:59Z.
    expiresAt: exp ? `${exp}T20:59:59.000Z` : null,
  };
}

/* ---------- platform ayarlari ---------- */

export type SettingsDraft = Record<keyof AdminPlatformSettingsValues, string>;

const BOOL_FIELDS = new Set<keyof AdminPlatformSettingsValues>(["requireSealsOnCheckIn"]);
const TEXT_FIELDS = new Set<keyof AdminPlatformSettingsValues>(["minAppVersion", "latestAppVersion"]);

export const SETTINGS_FIELDS: (keyof AdminPlatformSettingsValues)[] = [
  "maxStayDays",
  "maxBagsPerSlot",
  "defaultShopCapacity",
  "defaultPricePerDay",
  "bagMultiplierS",
  "bagMultiplierM",
  "bagMultiplierXl",
  "insuranceFeeTry",
  "earlyRefundRatio",
  "cancelFixedFeeTry",
  "latePickupFeeTry",
  "latePickupGraceMin",
  "checkInGraceMin",
  "requireSealsOnCheckIn",
  "platformHolidayDates",
  "minAppVersion",
  "latestAppVersion",
];

export function isBoolSetting(f: keyof AdminPlatformSettingsValues) {
  return BOOL_FIELDS.has(f);
}

export function settingsToDraft(v: AdminPlatformSettingsValues): SettingsDraft {
  const out = {} as SettingsDraft;
  for (const f of SETTINGS_FIELDS) {
    const x = v[f];
    out[f] = Array.isArray(x) ? x.join("\n") : x == null ? "" : String(x);
  }
  return out;
}

/** Taslak -> sunucu govdesi. Sayi olmayan girdi NaN kalir; sunucu `invalid_data` der. */
export function draftToValues(d: SettingsDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of SETTINGS_FIELDS) {
    const raw = d[f];
    if (BOOL_FIELDS.has(f)) out[f] = raw === "true";
    else if (TEXT_FIELDS.has(f)) out[f] = raw.trim();
    else if (f === "platformHolidayDates")
      out[f] = raw
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean);
    else out[f] = raw.trim() === "" ? NaN : Number(raw.trim().replace(",", "."));
  }
  return out;
}

/** Yazilan ifade tam esit olmali (buyuk/kucuk harf dahil): "onayla" kazara yazilmis sayilmaz. */
export function confirmationMatches(typed: string, phrase: string): boolean {
  return typed.trim() === phrase;
}

/* ---------- bayrak ---------- */

export type FlagDraft = { enabled: boolean; rolloutPct: string; allowedUserIds: string; description: string };

export function flagToDraft(f: AdminFeatureFlag): FlagDraft {
  return {
    enabled: f.enabled,
    rolloutPct: String(f.rolloutPct),
    allowedUserIds: f.allowedUserIds.join("\n"),
    description: f.description ?? "",
  };
}

export function flagDraftValid(d: FlagDraft): boolean {
  const n = Number(d.rolloutPct.trim());
  return d.rolloutPct.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 100 && d.description.length <= 500;
}

export function flagBody(d: FlagDraft) {
  return {
    enabled: d.enabled,
    rolloutPct: Number(d.rolloutPct.trim()),
    allowedUserIds: d.allowedUserIds
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean),
    description: d.description.trim() || null,
  };
}
