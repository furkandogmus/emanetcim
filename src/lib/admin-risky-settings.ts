/**
 * Riskli yonetim ayarlari — TEK KAYNAK. Mobil yonetici ucu bunlari yazarak onay
 * olmadan degistirmez; istemci ayri liste tutmaz (DTO `riskyFields`, 428 yaniti
 * `changes` + `phrase` tasir).
 */
export const RISKY_PLATFORM_SETTING_FIELDS = [
  "insuranceFeeTry",
  "earlyRefundRatio",
  "cancelFixedFeeTry",
  "latePickupFeeTry",
  "latePickupGraceMin",
  "defaultPricePerDay",
  "bagMultiplierS",
  "bagMultiplierM",
  "bagMultiplierXl",
  "requireSealsOnCheckIn",
  "minAppVersion",
  "latestAppVersion",
  // Kosullu: yalniz azalirsa / yakin tarih eklenirse (`riskyPlatformChanges`).
  "maxBagsPerSlot",
  "platformHolidayDates",
] as const;

export type RiskyPlatformSettingField = (typeof RISKY_PLATFORM_SETTING_FIELDS)[number];

export type RiskyChange = { field: RiskyPlatformSettingField; from: unknown; to: unknown };

/** Platform ayarlarinda riskli degisiklik icin yazilacak sabit ifade (dilden bagimsiz). */
export const PLATFORM_SETTINGS_CONFIRM_PHRASE = "ONAYLA";

/** Bu kadar gun icindeki yeni tatil gunu mevcut rezervasyonlari etkileyebilir. */
const NEAR_HOLIDAY_DAYS = 7;

/** `x.y.z` karsilastirma: a<b negatif, esit 0, a>b pozitif; bozuk girdi null. */
export function compareSemver(a: string, b: string): number | null {
  const pa = /^(\d+)\.(\d+)\.(\d+)$/.exec(a.trim());
  const pb = /^(\d+)\.(\d+)\.(\d+)$/.exec(b.trim());
  if (!pa || !pb) return null;
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Bayrak anahtarinda odeme, muhur, giris ya da isletmeye isaret eden parca.
 * Bayraklar serbest anahtarla olusur; liste elle tutulsa yeni `payments_v2` risksiz kalirdi.
 */
const RISKY_FLAG_PATTERN =
  /(pay|payment|refund|checkout|iyzico|stripe|seal|muhur|auth|login|otp|password|signin|sign_in|signup|register|coupon|price|fee|booking|maintenance|kill)/i;

export function isRiskyFeatureFlag(key: string): boolean {
  return RISKY_FLAG_PATTERN.test(key);
}

/** Bayrak icin yazilacak ifade: bayragin kendi anahtari. */
export function featureFlagConfirmPhrase(key: string): string {
  return key;
}

const norm = (v: unknown) => (v === "" || v === undefined ? null : v);

/** `YYYY-MM-DD`, Istanbul (UTC+3, yaz saati yok) takvim gunu. */
function istanbulDay(d: Date): string {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Onay isteyen degisiklikler. Para/muhur/surum alanlari her degisimde; kapasite
 * yalniz AZALINCA (mevcut rezervasyonlar sinirin ustunde kalir); tatil yalniz
 * bugun ya da onumuzdeki 7 gun EKLENINCE (o gunlerin rezervasyonlari etkilenir).
 */
export function riskyPlatformChanges(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
  now: Date = new Date(),
): RiskyChange[] {
  const out: RiskyChange[] = [];
  for (const field of RISKY_PLATFORM_SETTING_FIELDS) {
    const from = current[field];
    const to = next[field];
    if (field === "maxBagsPerSlot") {
      if (typeof from === "number" && typeof to === "number" && to < from) out.push({ field, from, to });
    } else if (field === "platformHolidayDates") {
      const before = new Set(Array.isArray(from) ? from : []);
      const today = istanbulDay(now);
      const limit = istanbulDay(new Date(now.getTime() + NEAR_HOLIDAY_DAYS * 86_400_000));
      const near = (Array.isArray(to) ? to : []).filter(
        (d): d is string => typeof d === "string" && !before.has(d) && d >= today && d <= limit,
      );
      if (near.length > 0) out.push({ field, from, to });
    } else if (norm(from) !== norm(to)) {
      out.push({ field, from: norm(from), to: norm(to) });
    }
  }
  return out;
}

/**
 * Surum degisiyorsa ifade YENI surumun kendisi: "0.4.0" yazan yonetici neyi
 * kilitledigini gorerek yazar. Kapatma (bos) ya da diger alanlar `ONAYLA`.
 */
export function platformSettingsConfirmPhrase(changes: RiskyChange[]): string {
  for (const f of ["minAppVersion", "latestAppVersion"] as const) {
    const c = changes.find((x) => x.field === f);
    if (c && typeof c.to === "string" && c.to) return c.to;
  }
  return PLATFORM_SETTINGS_CONFIRM_PHRASE;
}
