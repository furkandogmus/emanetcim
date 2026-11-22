/**
 * Riskli yonetim ayarlari — TEK KAYNAK.
 *
 * Mobil yonetici ekrani bir ayari degistirmeden once "yazarak onay" ister:
 * telefonda yanlis parmakla acilan bir anahtar, masaustunde fareyle secilen bir
 * kutudan cok daha kolay olur. Hangi alanin riskli oldugu istemcide AYRICA
 * yazilmaz: sunucu her alani `risky` bayragiyla dondurur, kapiyi da kendisi
 * dogrular. Iki liste olsaydi biri eksik kalir, istemci onaysiz gonderir,
 * sunucu reddeder ve yonetici "neden kaydetmiyor" diye sorardi.
 *
 * Riskli sayilan: para (ucret, iade orani, fiyat, carpan, gecikme toleransi —
 * gecikme ucreti ondan turer), muhur (teslim almada muhur zorunlulugu) ve
 * giris (minimum surum: altindaki uygulamalar acilamaz).
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
] as const;

export type RiskyPlatformSettingField = (typeof RISKY_PLATFORM_SETTING_FIELDS)[number];

/** Platform ayarlarinda riskli degisiklik icin yazilacak sabit ifade (dilden bagimsiz). */
export const PLATFORM_SETTINGS_CONFIRM_PHRASE = "ONAYLA";

/**
 * Bayrak anahtarinda odeme, muhur ya da kimlik dogrulamaya isaret eden parca.
 * Bayraklar serbest anahtarla olusur; listeyi elle tutmak yeni bir `payments_v2`
 * bayragini sessizce "risksiz" birakirdi.
 */
const RISKY_FLAG_PATTERN = /(pay|payment|refund|checkout|iyzico|stripe|seal|muhur|auth|login|otp|password|signin|sign_in)/i;

export function isRiskyFeatureFlag(key: string): boolean {
  return RISKY_FLAG_PATTERN.test(key);
}

/** Bayrak icin yazilacak ifade: bayragin kendi anahtari. */
export function featureFlagConfirmPhrase(key: string): string {
  return key;
}

/** Iki deger kumesi arasinda DEGISEN riskli alanlar. */
export function changedRiskyPlatformFields(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): RiskyPlatformSettingField[] {
  return RISKY_PLATFORM_SETTING_FIELDS.filter((f) => !sameValue(current[f], next[f]));
}

function sameValue(a: unknown, b: unknown): boolean {
  // Bos surum: sayfada "" ve veritabaninda null ayni "kapi kapali" demek.
  const norm = (v: unknown) => (v === "" || v === undefined ? null : v);
  return norm(a) === norm(b);
}
