import { sanitizeAuthCallbackUrl } from "@/lib/auth-callback-url";

/**
 * Giriş sonrası varış noktası — role göre, sekmeye göre DEĞİL.
 *
 * NEDEN VAR: 2026-08-22'de giriş ekranı iki sekme gösteriyordu (MİSAFİR / ESNAF) ve
 * bunlar farklı kimlik sistemleriymiş gibi davranıyordu. Arkada tek sistem var:
 * `authorize()` zaten e-posta VE telefon kabul ediyor. Sekme yalnızca girdi tipini
 * kısıtlıyordu (`type=tel`), yani e-postayla kayıtlı bir esnaf kendisi için
 * etiketlenmiş sekmeden GİREMİYORDU — çalışan yol "MİSAFİR" yazan sekmeydi, ama
 * oradan girince esnaf paneline değil misafir ana sayfasına düşüyordu (P1-16).
 *
 * Doğru model: varış noktası KİM OLDUĞUNDAN türer, hangi sekmeye tıklandığından
 * değil. Sekme artık yalnızca görsel bir ipucu.
 */

export type LandingRole = "ADMIN" | "PARTNER" | "USER" | string | null | undefined;

/** Rolün kendi ana sayfası. */
export function defaultLandingForRole(role: LandingRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "PARTNER":
      return "/partner";
    default:
      return "/";
  }
}

/**
 * Giriş sonrası nereye gidilecek.
 *
 * Kullanıcının gitmek istediği yer (`callbackUrl`) her zaman önceliklidir — korumalı
 * bir sayfadan yönlendirilmiş olabilir ve oraya dönmesi gerekir. Yalnızca anlamlı
 * bir hedef YOKKEN rol devreye girer.
 *
 * @param callbackUrl `sanitizeAuthCallbackUrl`'den geçmiş olmalı. "/" değeri
 *   "hedef belirtilmedi" anlamına gelir — sanitize edici geçersiz/harici URL'leri
 *   buna indirger, dolayısıyla rol varsayılanının devreye girmesi doğrudur.
 */
export function resolveLoginLanding(
  callbackUrl: string | null | undefined,
  role: LandingRole,
): string {
  const explicit = callbackUrl?.trim();
  if (explicit && explicit !== "/") return explicit;
  return defaultLandingForRole(role);
}

/**
 * Oturumu zaten acik kullanici giris/kayit sayfasina geldiginde nereye gider.
 * `callbackUrl` varsa ORAYA (checkout donusu baska sekmede giris yapilmis
 * olabilir); yoksa rolun sayfasi. Ham deger burada suzulur.
 */
export function signedInAuthPageRedirect(
  locale: string,
  role: LandingRole,
  rawCallbackUrl: string | string[] | null | undefined,
): string {
  const callback = sanitizeAuthCallbackUrl(typeof rawCallbackUrl === "string" ? rawCallbackUrl : null);
  if (callback !== "/") return resolveLoginLanding(callback, role);
  if (role === "ADMIN") return `/${locale}/admin`;
  if (role === "PARTNER") return `/${locale}/partner`;
  return `/${locale}/search`;
}
