import prisma from "@/lib/db";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { partnerProfileService } from "@/services/PartnerProfileService";

/**
 * Kullanicinin kendi ad / telefon / avatar-kaldirma duzenlemesi: mobil
 * `PUT /auth/me` ve web profil sayfasi AYNI govdeyi cagirir.
 *
 * `undefined` alan = dokunma. Telefon ONCE yazilir: is kurali redleri (giris
 * kilidi, cakisma) hicbir sey yazmadan doner, ad yarim kalmaz. Goruntuleme
 * (impersonation) kapisi tasiyicida kalir; bu govde kimin cagirdigini bilmez.
 */
export type UpdateOwnProfileInput = {
  userId: string;
  name?: unknown;
  phone?: unknown;
  removeImage?: boolean;
};

export type UpdateOwnProfileResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_name" | "invalid_phone" | "phone_taken" | "phone_locked" | "no_fields";
    };

export const MAX_PROFILE_NAME_LENGTH = 100;

export async function updateOwnProfile(input: UpdateOwnProfileInput): Promise<UpdateOwnProfileResult> {
  const data: { name?: string; image?: null } = {};

  if (input.name !== undefined) {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.trim().length > MAX_PROFILE_NAME_LENGTH
    ) {
      return { ok: false, reason: "invalid_name" };
    }
    data.name = input.name.trim();
  }

  if (input.phone !== undefined && input.phone !== null && typeof input.phone !== "string") {
    return { ok: false, reason: "invalid_phone" };
  }
  const phone = input.phone as string | null | undefined;

  if (input.removeImage) data.image = null;

  if (Object.keys(data).length === 0 && phone === undefined) {
    return { ok: false, reason: "no_fields" };
  }

  try {
    if (phone !== undefined) {
      const result = await partnerProfileService.updatePhone(input.userId, phone);
      if (!result.ok) {
        if (result.reason === "already_registered") return { ok: false, reason: "phone_taken" };
        if (result.reason === "login_phone_locked") return { ok: false, reason: "phone_locked" };
        return { ok: false, reason: "invalid_phone" };
      }
    }
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: input.userId }, data });
    }
    return { ok: true };
  } catch (err) {
    // Numara baskasinda kayitliysa bu sunucu hatasi degil, cakismadir.
    if (isPrismaUniqueViolation(err)) return { ok: false, reason: "phone_taken" };
    throw err;
  }
}
