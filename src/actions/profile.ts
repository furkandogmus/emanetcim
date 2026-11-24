"use server";

import { requireUser } from "@/lib/action-auth";
import { rateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import prisma from "@/lib/db";
import { getLocale } from "next-intl/server";
import { sendPasswordSetNotice } from "@/lib/mail";
import { updateOwnProfile, type UpdateOwnProfileResult } from "@/services/auth/own-profile";
import { setOwnPassword, type SetOwnPasswordResult } from "@/services/auth/set-own-password";

/**
 * Web profil sayfasi. Kurallar mobil `PUT /auth/me` ve `/auth/me/password` ile
 * AYNI servislerde; burasi yalnizca kimlik + hata anahtari esler. Web
 * "olarak goruntule" oturumunda `requireUser` reddeder (salt okunur), mobil uc
 * `forbidWhileImpersonating` ile; ikisinde de sifre yazilmaz.
 */

const PROFILE_ERROR_TO_KEY: Record<Extract<UpdateOwnProfileResult, { ok: false }>["reason"], string> = {
  invalid_name: "Errors.invalidName",
  invalid_phone: "Errors.invalidTrPhone",
  phone_taken: "Errors.phoneAlreadyRegistered",
  phone_locked: "Errors.phoneLoginLocked",
  no_fields: "Errors.invalidInput",
};

const PASSWORD_ERROR_TO_KEY: Record<Extract<SetOwnPasswordResult, { ok: false }>["reason"], string> = {
  invalid_password: "Errors.passwordTooShort",
  current_password_required: "Errors.currentPasswordRequired",
  invalid_current_password: "Errors.invalidCurrentPassword",
  not_found: "Errors.unauthorized",
};

export async function updateProfileAction(input: { name: string; phone: string }) {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const result = await updateOwnProfile({
    userId: auth.actor.id,
    name: input?.name,
    phone: input?.phone,
  });
  if (!result.ok) return { ok: false as const, error: PROFILE_ERROR_TO_KEY[result.reason] };
  return { ok: true as const };
}

export async function changePasswordAction(input: { currentPassword?: string; newPassword: string }) {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false as const, error: auth.error };

  // Mobil ucla ayni kova: mevcut sifre tahmini iki yoldan ayri ayri denenemesin.
  if (!(await rateLimit(`mobile_pwd_change:${auth.actor.id}`, 5, 15 * 60_000))) {
    return { ok: false as const, error: "Errors.tooManyRequests" };
  }

  const result = await setOwnPassword({
    userId: auth.actor.id,
    currentPassword: input?.currentPassword || undefined,
    newPassword: typeof input?.newPassword === "string" ? input.newPassword : "",
  });
  if (!result.ok) return { ok: false as const, error: PASSWORD_ERROR_TO_KEY[result.reason] };

  if (result.firstPassword) {
    // Sifresiz hesaba ilk sifre: mobil uctaki gibi sahibine haber verilir.
    const user = await prisma.user.findUnique({ where: { id: auth.actor.id }, select: { email: true } });
    if (user?.email) {
      const locale = await getLocale();
      void sendPasswordSetNotice(user.email, locale).catch((err) =>
        logger.error({ err, userId: auth.actor.id }, "password_set_notice_failed"),
      );
    }
  }
  /*
    `tokenVersion` her durumda artti: web oturumu en gec bir dakikada duser
    (`auth.ts` yeniden dogrulama). Istemci kullaniciyi yeniden girise yollar.
  */
  return { ok: true as const, firstPassword: result.firstPassword };
}

