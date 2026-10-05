"use server";

import { z } from "zod";
import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { parseCoordinates } from "@/lib/coordinates";
import { createPartnerResetLink } from "@/lib/partner-reset-link";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { partnerOnboardingService } from "@/services/PartnerOnboardingService";
import { adminSetUserPassword } from "@/services/auth/admin-set-password";

const convertSchema = z.object({
  userId: z.string().uuid(),
  phone: z.string().trim().min(10).max(20),
  shopName: z.string().trim().min(2).max(200),
  shopAddress: z.string().trim().min(5).max(500),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  location: z.string().trim().min(3).max(2000),
});

export type AdminConvertGuestResult =
  | { ok: true; shopId: string; phone: string; resetUrl: string | null }
  | { ok: false; error: string };

/**
 * Admin: misafir hesabını esnafa çevirir. Gövde `PartnerOnboardingService`te.
 * Hesabın şifresi yoksa (ör. Google ile girmiş) şifre belirleme bağı da döner.
 */
export async function adminConvertGuestToPartnerAction(
  raw: unknown,
): Promise<AdminConvertGuestResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = convertSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Errors.invalidData" };
  const input = parsed.data;

  const coords = parseCoordinates(input.location);
  if (!coords) return { ok: false, error: "Errors.shopLocationRequired" };

  const result = await partnerOnboardingService.convertGuestToPartner({
    userId: input.userId,
    phone: input.phone,
    shopName: input.shopName,
    shopAddress: input.shopAddress,
    city: input.city,
    district: input.district,
    ...coords,
  });
  if (!result.ok) {
    const error = {
      invalid_tr_phone: "Errors.invalidTrPhone",
      phone_already_registered: "Errors.phoneAlreadyRegistered",
      not_found: "Errors.userNotFound",
      not_guest: "Errors.userNotGuest",
    }[result.reason];
    return { ok: false, error };
  }

  const link = result.hasPassword ? null : await createPartnerResetLink(result.phone);

  writeAuditLog({
    actorUserId: auth.actor.id,
    actorRole: auth.actor.role,
    action: "user.converted_to_partner",
    entityType: "User",
    entityId: input.userId,
    metadata: {
      shopId: result.shopId,
      phone: result.phone,
      ...(link
        ? { tokenFingerprint: link.tokenFingerprint, expiresAt: link.expiresAt.toISOString() }
        : {}),
    },
    ip: await getClientIpOrNull(),
  });

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/partners");
  revalidatePathAllLocales("/admin/applications");
  return { ok: true, shopId: result.shopId, phone: result.phone, resetUrl: link?.resetUrl ?? null };
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

  const result = await adminSetUserPassword(parsed.data.userId, parsed.data.password);
  if (!result.ok) {
    const error = {
      invalid_password: "Errors.passwordTooShort",
      not_found: "Errors.userNotFound",
      forbidden_target: "Errors.unauthorized",
    }[result.reason];
    return { ok: false, error };
  }

  writeAuditLog({
    actorUserId: auth.actor.id,
    actorRole: auth.actor.role,
    action: "user.password_set_by_admin",
    entityType: "User",
    entityId: parsed.data.userId,
    metadata: {},
    ip: await getClientIpOrNull(),
  });

  return { ok: true, phone: result.phone, name: result.name };
}
