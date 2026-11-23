import { api } from "./api";
import { normalizeTrGsm10 } from "./phone";
import type { AdminRoleChangeResponse, AdminUserDetail, Role } from "./types";

/**
 * Admin kullanici islemleri: istekler ve ekranin onay kapilari. Kararlar sunucuda
 * (`AdminUserService`, `AccountPrivacyService.anonymizeByAdmin`); buradaki kontroller
 * yalnizca dugmeyi acip kapatir, sunucu ayni seyi yeniden dogrular.
 */

export const ROLES: Role[] = ["GUEST", "PARTNER", "ADMIN"];

/** Sunucu `ADMIN_ERASURE_REASON_MIN` ile ayni. */
export const ERASURE_REASON_MIN = 5;

/** Sunucu `erasureConfirmMatches` ile ayni kural: e-posta harf duyarsiz, telefon 0/+90 farksiz. */
export function erasureConfirmMatches(typed: string, user: Pick<AdminUserDetail, "email" | "phone">): boolean {
  const v = typed.trim();
  if (!v) return false;
  if (user.email && v.toLowerCase() === user.email.trim().toLowerCase()) return true;
  const phone = normalizeTrGsm10(v);
  return !!phone && !!user.phone && phone === normalizeTrGsm10(user.phone);
}

export function canSubmitErasure(
  form: { confirm: string; reason: string },
  user: Pick<AdminUserDetail, "email" | "phone">,
): boolean {
  return erasureConfirmMatches(form.confirm, user) && form.reason.trim().length >= ERASURE_REASON_MIN;
}

/** Silinebilir mi: kendi silmesiyle ayni kural (yalnizca misafir), kendisi degil. */
export function canErase(user: AdminUserDetail, myId: string | null): boolean {
  return user.role === "GUEST" && user.id !== myId && !user.isAnonymized && (!!user.email || !!user.phone);
}

const path = (id: string, tail: string) => `/admin/users/${encodeURIComponent(id)}/${tail}`;

export const changeUserRole = (id: string, role: Role) =>
  api<AdminRoleChangeResponse>(path(id, "role"), { method: "POST", body: { role } });

export const sendUserPasswordReset = (id: string, locale: string) =>
  api<{ ok: true }>(path(id, "password-reset"), { method: "POST", body: { locale } });

export const resendUserVerification = (id: string, locale: string) =>
  api<{ ok: true }>(path(id, "verification-email"), { method: "POST", body: { locale } });

export const setUserPassword = (id: string, password: string) =>
  api<{ ok: true }>(path(id, "password"), { method: "POST", body: { password } });

/** Inceleme kum havuzu hesabi: test dukkanlarini gorur ve rezervasyon yapabilir. */
export const setUserTestAccount = (id: string, isTest: boolean) =>
  api<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { isTest } });

export const anonymizeUser = (id: string, confirm: string, reason: string) =>
  api<{ ok: true }>(path(id, "anonymize"), { method: "POST", body: { confirm, reason } });

// Karistirilabilecek karakterler (0/O, 1/l/I) yok: sifre WhatsApp'tan okunup elle yaziliyor (web ile ayni).
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Crypto = { getRandomValues?: (a: Uint32Array) => Uint32Array };

function secureRandom(): Crypto["getRandomValues"] | null {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  return c?.getRandomValues ? c.getRandomValues.bind(c) : null;
}

/**
 * Onerilen sifre; yalnizca guvenli rastgelelik (`crypto.getRandomValues`) ile.
 * Hermes'te her surumde yok ve yeni yerel modul OTA ile gidemez: kaynak yoksa
 * `null` doner, yonetici sifreyi kendisi yazar. `Math.random` kullanilmaz.
 */
export function generatePassword(length = 10): string | null {
  const fill = secureRandom();
  if (!fill) return null;
  // 2^32 % 56 != 0: sinirin ustundeki degerler atilir, harf dagilimi esit kalir.
  const limit = Math.floor(0x1_0000_0000 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < length) {
    for (const v of fill(new Uint32Array(length))) {
      if (v < limit && out.length < length) out += ALPHABET[v % ALPHABET.length];
    }
  }
  return out;
}
