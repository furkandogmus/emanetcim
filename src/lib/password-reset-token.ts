import crypto from "crypto";
import prisma from "@/lib/db";

/** E-posta doğrulama tokenlarından ayrı tutmak için (verify-email ham e-posta kullanır). */
export const PASSWORD_RESET_IDENTIFIER_PREFIX = "password-reset:";

export function passwordResetIdentifier(email: string): string {
  return `${PASSWORD_RESET_IDENTIFIER_PREFIX}${email.trim().toLowerCase()}`;
}

/**
 * Şifre sıfırlama tokenı: 1 saat geçerli, aynı e-posta için önceki sıfırlama tokenı silinir.
 */
export async function generatePasswordResetToken(email: string) {
  const identifier = passwordResetIdentifier(email);
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  const existing = await prisma.verificationToken.findFirst({
    where: { identifier },
  });
  if (existing) {
    await prisma.verificationToken.delete({
      where: { token: existing.token },
    });
  }

  return prisma.verificationToken.create({
    data: { identifier, token, expires },
  });
}
