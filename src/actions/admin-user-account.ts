"use server";

import { z } from "zod";
import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import {
  adminPartnerCreateService,
  type AdminGuestConvertFailure,
} from "@/services/AdminPartnerCreateService";
import { adminSetUserPassword } from "@/services/auth/admin-set-password";

export type AdminConvertGuestResult =
  | { ok: true; shopId: string; phone: string; resetUrl: string | null }
  | { ok: false; error: string };

const CONVERT_ERROR_KEY: Record<AdminGuestConvertFailure, string> = {
  invalid_data: "Errors.invalidData",
  location_required: "Errors.shopLocationRequired",
  invalid_tr_phone: "Errors.invalidTrPhone",
  phone_already_registered: "Errors.phoneAlreadyRegistered",
  not_found: "Errors.userNotFound",
  not_guest: "Errors.userNotGuest",
};

/**
 * Admin: misafir hesabını esnafa çevirir. Gövde `AdminPartnerCreateService.convertGuest`te
 * (mobil `admin/partners` ucu da onu çağırır). Şifresiz hesap için şifre bağı da döner.
 */
export async function adminConvertGuestToPartnerAction(
  raw: unknown,
): Promise<AdminConvertGuestResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const result = await adminPartnerCreateService.convertGuest(auth.actor, raw, { ip: await getClientIpOrNull() });
  if (!result.ok) return { ok: false, error: CONVERT_ERROR_KEY[result.reason] };

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/partners");
  revalidatePathAllLocales("/admin/applications");
  return { ok: true, shopId: result.shopId, phone: result.phone, resetUrl: result.resetUrl };
}

const setPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string(),
});

export type AdminSetPasswordActionResult =
  | { ok: true; phone: string | null; name: string | null }
  | { ok: false; error: string };

/**
 * Admin: misafir/esnaf için yeni şifre belirler. Şifre denetim kaydına YAZILMAZ;
 * yalnızca "kim, kime, ne zaman".
 */
export async function adminSetUserPasswordAction(
  raw: unknown,
): Promise<AdminSetPasswordActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Errors.invalidData" };

  // Denetim kaydi serviste: mobil admin ucu da ayni govdeyi cagirir.
  const result = await adminSetUserPassword(parsed.data.userId, parsed.data.password, {
    userId: auth.actor.id,
    role: auth.actor.role,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) {
    const error = {
      invalid_password: "Errors.passwordTooShort",
      not_found: "Errors.userNotFound",
      forbidden_target: "Errors.unauthorized",
    }[result.reason];
    return { ok: false, error };
  }

  return { ok: true, phone: result.phone, name: result.name };
}
