"use server";

import { getClientIpOrNull } from "@/lib/client-ip";

import { z } from "zod";
import prisma from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/mail";
import { getLocale } from "next-intl/server";
import { generatePasswordResetToken } from "@/lib/password-reset-token";
import {
  consumePasswordResetToken,
  MIN_NEW_PASSWORD_LENGTH,
  MAX_NEW_PASSWORD_LENGTH,
  type PasswordResetErrorCode,
} from "@/services/auth/password-reset";



const emailSchema = z.string().trim().email().max(320);

const resetSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(MIN_NEW_PASSWORD_LENGTH).max(MAX_NEW_PASSWORD_LENGTH),
  confirmPassword: z.string().min(MIN_NEW_PASSWORD_LENGTH).max(MAX_NEW_PASSWORD_LENGTH),
});

/** Servis kodu -> bu action'in DEGISMEYEN dis sozlesmesi (istemci bunlari okuyor). */
const RESET_CODE_TO_ERROR: Record<PasswordResetErrorCode, "invalid" | "invalid_token" | "expired"> = {
  INVALID_INPUT: "invalid",
  INVALID_TOKEN: "invalid_token",
  EXPIRED: "expired",
  USER_NOT_FOUND: "invalid_token",
  UNKNOWN: "invalid",
};

/**
 * Şifre sıfırlama e-postası isteği. Hesap yoksa / OAuth ise de aynı genel yanıt (enumeration yok).
 * Rate limit: IP başına 10 / 15 dk, e-posta başına 5 / saat.
 */
export async function requestPasswordResetAction(rawEmail: string) {
  const ip = await getClientIpOrNull();
  if (!(await rateLimit(`forgot-password:ip:${ip}`, 10, 15 * 60 * 1000))) {
    return { ok: true as const };
  }

  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: true as const };
  }

  const email = parsed.data.toLowerCase();

  if (!(await rateLimit(`forgot-password:email:${email}`, 5, 60 * 60 * 1000))) {
    return { ok: true as const };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    return { ok: true as const };
  }

  const locale = await getLocale();
  const row = await generatePasswordResetToken(user.email);
  await sendPasswordResetEmail(user.email, row.token, locale);

  return { ok: true as const };
}

/**
 * Token ile yeni şifre belirleme. IP başına 30 deneme / saat (brute-force azaltma).
 *
 * GÖVDE `src/services/auth/password-reset.ts`'te: aynı kural mobil uçta da
 * yazılıydı ve kopyalar ayrışmıştı — en ağırı, bu web yolunun `tokenVersion`'ı
 * artırmaması yüzünden şifre değişse bile mobil oturumların 30 gün daha ayakta
 * kalmasıydı. Gerekçesi servis dosyasının başında.
 */
export async function resetPasswordWithTokenAction(input: unknown) {
  const ip = await getClientIpOrNull();
  if (!(await rateLimit(`reset-password:ip:${ip}`, 30, 60 * 60 * 1000))) {
    return { ok: false as const, error: "rate_limited" as const };
  }

  const parsed = resetSchema.safeParse(input);
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
    return { ok: false as const, error: "invalid" as const };
  }

  const result = await consumePasswordResetToken(
    parsed.data.token,
    parsed.data.password,
  );
  if (result.ok) return { ok: true as const };

  return {
    ok: false as const,
    error: RESET_CODE_TO_ERROR[result.code],
  };
}
