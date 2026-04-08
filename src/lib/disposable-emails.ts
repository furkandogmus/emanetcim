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
