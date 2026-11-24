import crypto from "crypto";

/**
 * Mobil sifre sifirlama KODU: e-postadaki 6 haneli sayi.
 *
 * NEDEN VAR (2026-11-22): sifirlama e-postasi yalnizca web bagi tasiyordu.
 * Mobil uygulamadaki kullanici bagi telefonda actiginda tarayiciya dusuyor,
 * sifreyi orada degistiriyor ve uygulamaya geri donup YENIDEN giris yapmak
 * zorunda kaliyordu. Kod ayni istekte gider, uygulama icinde girilir ve
 * basarida oturum cifti doner.
 *
 * Kodun KENDISI saklanmaz: alti hane bir milyon olasilik demek, duz SHA-256
 * sizan bir veritabanindan saniyeler icinde geri cozulur. HMAC anahtari
 * `AUTH_SECRET`: veritabani tek basina sizarsa kod cozulemez. E-posta da
 * imzaya girer; ayni kod iki farkli hesapta ayni hash'i uretmez.
 */

export const PASSWORD_RESET_CODE_LENGTH = 6;
/** Kodun omru: 30 dakika (bag 1 saat; kod tahmin edilebilir uzaydan geldigi icin daha kisa). */
export const PASSWORD_RESET_CODE_TTL_MS = 30 * 60 * 1000;
/** Bir kod icin izin verilen yanlis deneme. Besinci yanlista kod olur. */
export const PASSWORD_RESET_CODE_MAX_ATTEMPTS = 5;
/** E-posta basina kayan pencerede toplam yanlis siniri; yeni kod istemek sifirlamaz. */
export const PASSWORD_RESET_CODE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_CODE_WINDOW_MAX_FAILURES = 10;

function codeSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s?.trim()) {
    // `guest-lookup-token.ts` ile ayni sozlesme: sabit bir yedek sir YOK.
    throw new Error("AUTH_SECRET is required for password reset codes");
  }
  return s;
}

export function normalizeResetEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Esit olasilikli 6 hane (`randomInt` modulo sapmasi tasimaz). */
/** 6 haneli tek kullanimlik sayi kodu (sifirlama ve mobil giris ortak). Parola degil. */
export function generateOneTimeCode(): string {
  return crypto.randomInt(0, 10 ** PASSWORD_RESET_CODE_LENGTH).toString().padStart(PASSWORD_RESET_CODE_LENGTH, "0");
}

export function generatePasswordResetCode(): string {
  return generateOneTimeCode();
}

export function hashPasswordResetCode(email: string, code: string): string {
  return crypto
    .createHmac("sha256", codeSecret())
    .update(`${normalizeResetEmail(email)}:${code}`)
    .digest("hex");
}

/** Bicim kapisi: yalnizca tam 6 rakam. */
export function isWellFormedResetCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

/** Sabit zamanli karsilastirma: uzunluklar farkliysa da erken cikis zamanlamasi sizdirmaz. */
export function resetCodeMatches(email: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashPasswordResetCode(email, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Ayni HMAC, baska bir kod turu icin (`scope` alan ayirici): mobil giris kodu
 * sifirlama koduyla ayni hash'i uretmez.
 */
export function hashScopedCode(scope: string, subject: string, code: string): string {
  return crypto.createHmac("sha256", codeSecret()).update(`${scope}:${subject}:${code}`).digest("hex");
}

export function scopedCodeMatches(scope: string, subject: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashScopedCode(scope, subject, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
