import { api } from "./api";
import { normalizeTrGsm10 } from "./phone";
import type {
  AdminConvertPartnerInput,
  AdminConvertPartnerResponse,
  AdminRoleChangeResponse,
  AdminUserDetail,
  Role,
} from "./types";

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

/** Inceleme (App Review) hesabi: test dukkanlarini gorur ve rezervasyon yapabilir. */
export const setUserReviewSandbox = (id: string, reviewSandbox: boolean) =>
  api<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { reviewSandbox } });

export const anonymizeUser = (id: string, confirm: string, reason: string) =>
  api<{ ok: true }>(path(id, "anonymize"), { method: "POST", body: { confirm, reason } });

/** Kalici silme ve IP engelinde gerekce alt siniri (sunucu semasi ile ayni). */
export const DESTRUCTIVE_REASON_MIN = 3;

/**
 * Kalici silme: kendisi, yonetici ve anonim hesap degil. Yonetici once iki admin
 * onayli rol akisiyla dusurulur. Odeme gecmisi kurali sunucuda (`has_payment_history`).
 */
export function canHardDelete(user: Pick<AdminUserDetail, "id" | "role" | "isAnonymized">, myId: string | null): boolean {
  return user.id !== myId && user.role !== "ADMIN" && !user.isAnonymized;
}

/** IP engeli: kayitli son IP varsa ve kendisi degilse. */
export function canBlockIp(user: Pick<AdminUserDetail, "id" | "lastIp">, myId: string | null): boolean {
  return user.id !== myId && !!user.lastIp;
}

/** Esnafa cevirme yalniz misafir hesapta (sunucu `not_guest`). */
export function canConvertToPartner(user: Pick<AdminUserDetail, "role" | "isAnonymized" | "isBanned">): boolean {
  return user.role === "GUEST" && !user.isAnonymized && !user.isBanned;
}

/** Sunucu semasinin istemci yansimasi: dugme ancak alanlar gecerliyken acilir. */
export function isConvertFormValid(f: AdminConvertPartnerInput): boolean {
  return (
    normalizeTrGsm10(f.phone) != null &&
    f.shopName.trim().length >= 2 &&
    f.shopAddress.trim().length >= 5 &&
    f.location.trim().length >= 3
  );
}

export const deleteUser = (id: string, reason: string) =>
  api<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", body: { reason } });

export const blockUserIp = (id: string, reason: string) =>
  api<{ ok: true; ip: string }>(path(id, "block-ip"), { method: "POST", body: { reason } });

export const convertUserToPartner = (id: string, input: AdminConvertPartnerInput) =>
  api<AdminConvertPartnerResponse>(path(id, "convert-partner"), {
    method: "POST",
    body: {
      phone: input.phone.trim(),
      shopName: input.shopName.trim(),
      shopAddress: input.shopAddress.trim(),
      ...(input.city?.trim() ? { city: input.city.trim() } : {}),
      ...(input.district?.trim() ? { district: input.district.trim() } : {}),
      location: input.location.trim(),
    },
  });

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
