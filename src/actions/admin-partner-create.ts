"use server";

import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import {
  adminPartnerCreateService,
  type AdminPartnerCreateFailure,
} from "@/services/AdminPartnerCreateService";

export type AdminCreatePartnerResult =
  | { ok: true; shopId: string; resetUrl: string }
  | { ok: false; error: string };

const ERROR_KEY: Record<AdminPartnerCreateFailure, string> = {
  invalid_data: "Errors.invalidData",
  location_required: "Errors.shopLocationRequired",
  invalid_email: "Errors.invalidEmail",
  invalid_tr_phone: "Errors.invalidTrPhone",
  phone_already_registered: "Errors.phoneAlreadyRegistered",
  email_already_registered: "Errors.emailAlreadyRegistered",
};

/**
 * Admin: esnaf adına hesap + dükkan açar, esnafa iletilecek şifre bağını döner.
 * Gövde `AdminPartnerCreateService`te (mobil yönetici ucu da onu çağırır).
 */
export async function adminCreatePartnerAction(raw: unknown): Promise<AdminCreatePartnerResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const result = await adminPartnerCreateService.createPartner(auth.actor, raw, { ip: await getClientIpOrNull() });
  if (!result.ok) return { ok: false, error: ERROR_KEY[result.reason] };

  revalidatePathAllLocales("/admin/partners");
  revalidatePathAllLocales("/admin/applications");
  return { ok: true, shopId: result.shopId, resetUrl: result.resetUrl };
}
