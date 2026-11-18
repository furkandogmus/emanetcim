/**
 * Popüler geçici (disposable/tmp) e-posta domainleri listesi.
 * Bu liste en yaygın servisleri kapsar ve manuel olarak genişletilebilir.
 */
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "spam4.me",
  "grr.la",
  "temp-mail.org",
  "temp-mail.com",
  "mailinator.com",
  "yopmail.com",
  "mailnesia.com",
  "dispostable.com",
  "trashmail.com",
  "getnada.com",
  "mohmal.com",
  "owlymail.com",
  "dropmail.me",
  "maildrop.cc",
  "getairmail.com",
  "protonmail.ch", // Bazı durumlarda bloklanmak istenmeyebilir ama genelde botlar kullanır
  "tempmail.net",
  "emailondeck.com",
  "throwawaymail.com",
  "generator.email",
  "mintemail.com",
  "fakeinbox.com",
  "disposable.com",
  "tmail.com",
  "tmpmail.com",
  "tmpmail.org",
  "yomail.info",
  "crazymailing.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
]);

/**
 * Verilen e-posta adresinin geçici bir servis olup olmadığını kontrol eder.
 * @param email E-posta adresi
 * @returns boolean
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  
  const domain = email.split("@")[1].toLowerCase();
  
  // Tam eşleşme kontrolü
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  
  // Alt domain kontrolü (örn: sub.10minutemail.com)
  for (const disposable of DISPOSABLE_DOMAINS) {
    if (domain.endsWith("." + disposable)) return true;
  }
  
  return false;
}

/**
 * Bot kayit kalibi (2026-11-18, prod'da goruldu): `adsoyad.NNNNN@gmail.com` —
 * kucuk harf ad+soyad, nokta, tam bes rakam. Gercek Gmail hesaplari (dogrulamali
 * Google girisi de geciyor), yani kod istemek ya da Google'in dogrulamasi durdurmuyor.
 * Yalnizca YENI kayitta bakilir; var olan hesaplar girmeye devam eder.
 */
const BOT_PATTERN_LOCAL = /^[a-z]{4,}\d{5}$/;
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Gmail noktalari ve `+etiket`i yok sayar: `adsoyad.12345`, `adsoyad12345` ve
 * `adsoyad.12345+x` ayni kutuya gider. Kalip bu kanonik bicimde aranir; yoksa
 * nokta kaldirarak ya da etiket ekleyerek engel asiliyordu.
 */
export function isBotPatternEmail(email: string): boolean {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain || !GMAIL_DOMAINS.has(domain)) return false;
  const canonical = local.split("+")[0].replace(/\./g, "");
  return BOT_PATTERN_LOCAL.test(canonical);
}

/** Yeni hesap acilmasina izin verilmeyen e-posta: gecici domain ya da bot kalibi. */
export function isBlockedSignupEmail(email: string): boolean {
  return isDisposableEmail(email) || isBotPatternEmail(email);
}
