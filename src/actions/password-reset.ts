"use server";

import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/auth-password";
import { sendPasswordResetEmail } from "@/lib/mail";
import { getLocale } from "next-intl/server";
import logger from "@/lib/logger";
import {
  generatePasswordResetToken,
  PASSWORD_RESET_IDENTIFIER_PREFIX,
  PASSWORD_RESET_PHONE_PREFIX,
  isPhoneResetIdentifier,
} from "@/lib/password-reset-token";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

const emailSchema = z.string().trim().email().max(320);

const resetSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

/**
 * Şifre sıfırlama e-postası isteği. Hesap yoksa / OAuth ise de aynı genel yanıt (enumeration yok).
 * Rate limit: IP başına 10 / 15 dk, e-posta başına 5 / saat.
 */
export async function requestPasswordResetAction(rawEmail: string) {
  const ip = await clientIp();
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
 */
export async function resetPasswordWithTokenAction(input: unknown) {
  const ip = await clientIp();
  if (!(await rateLimit(`reset-password:ip:${ip}`, 30, 60 * 60 * 1000))) {
    return { ok: false as const, error: "rate_limited" as const };
  }

  const parsed = resetSchema.safeParse(input);
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
    return { ok: false as const, error: "invalid" as const };
  }

  const { token, password } = parsed.data;

  const row = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (
    !row ||
    !row.identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)
  ) {
    return { ok: false as const, error: "invalid_token" as const };
  }

  if (row.expires < new Date()) {
    // Suresi gecmis token temizligi; basarisizligi akisi bozmaz ama gorunur olmali.
    await prisma.verificationToken
      .delete({ where: { token } })
      .catch((err) => logger.error({ err }, "expired_reset_token_cleanup_failed"));
    return { ok: false as const, error: "expired" as const };
  }

  const user = await (async () => {
    if (isPhoneResetIdentifier(row.identifier)) {
      const phone = row.identifier.slice(PASSWORD_RESET_PHONE_PREFIX.length);
      return prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });
    }
    const email = row.identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length);
    return prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  })();

  if (!user) {
    return { ok: false as const, error: "invalid_token" as const };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return { ok: true as const };
}
