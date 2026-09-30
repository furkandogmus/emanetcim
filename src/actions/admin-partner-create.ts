"use server";

import { z } from "zod";
import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { parseCoordinates } from "@/lib/coordinates";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { createPartnerResetLink } from "@/lib/partner-reset-link";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { partnerOnboardingService } from "@/services/PartnerOnboardingService";

const schema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().optional().or(z.literal("")),
  shopName: z.string().trim().min(2).max(200),
  shopAddress: z.string().trim().min(5).max(500),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  /** Google Maps linki ya da `enlem, boylam` — `parseCoordinates`. */
  location: z.string().trim().min(3).max(2000),
});

export type AdminCreatePartnerResult =
  | { ok: true; shopId: string; resetUrl: string }
  | { ok: false; error: string };

/**
 * Admin: esnaf adına hesap + dükkan açar, esnafa iletilecek şifre bağını döner.
 * Gövde `PartnerOnboardingService`te; kurallar ve NEDEN orada yazılı.
 */
export async function adminCreatePartnerAction(raw: unknown): Promise<AdminCreatePartnerResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Errors.invalidData" };
  const input = parsed.data;

  const coords = parseCoordinates(input.location);
  if (!coords) return { ok: false, error: "Errors.shopLocationRequired" };

  if (input.email && isDisposableEmail(input.email)) {
    return { ok: false, error: "Errors.invalidEmail" };
  }

  const result = await partnerOnboardingService.createPartnerWithShop({
    ownerName: input.ownerName,
    phone: input.phone,
    email: input.email || null,
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
      email_already_registered: "Errors.emailAlreadyRegistered",
    }[result.reason];
    return { ok: false, error };
  }

  const link = await createPartnerResetLink(result.phone);

  writeAuditLog({
    actorUserId: auth.actor.id,
    actorRole: auth.actor.role,
    action: "partner.created_by_admin",
    entityType: "Shop",
    entityId: result.shopId,
    metadata: {
      userId: result.userId,
      phone: result.phone,
      tokenFingerprint: link.tokenFingerprint,
      expiresAt: link.expiresAt.toISOString(),
    },
    ip: await getClientIpOrNull(),
  });

  revalidatePathAllLocales("/admin/partners");
  revalidatePathAllLocales("/admin/applications");
  return { ok: true, shopId: result.shopId, resetUrl: link.resetUrl };
}
