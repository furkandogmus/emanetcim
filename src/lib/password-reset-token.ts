import crypto from "crypto";
import prisma from "@/lib/db";

/** E-posta doğrulama tokenlarından ayrı tutmak için (verify-email ham e-posta kullanır). */
export const PASSWORD_RESET_IDENTIFIER_PREFIX = "password-reset:";
/** Telefon tabanlı şifre sıfırlama identifier öneki */
export const PASSWORD_RESET_PHONE_PREFIX = "password-reset:phone:";

export function passwordResetIdentifier(email: string): string {
  return `${PASSWORD_RESET_IDENTIFIER_PREFIX}${email.trim().toLowerCase()}`;
}

export function passwordResetPhoneIdentifier(phone: string): string {
  return `${PASSWORD_RESET_PHONE_PREFIX}${phone}`;
}

export function isPhoneResetIdentifier(identifier: string): boolean {
  return identifier.startsWith(PASSWORD_RESET_PHONE_PREFIX);
}

/**
 * 1 saat geçerli token oluşturur. Aynı identifier için önceki token varsa silinir.
 */
async function createToken(identifier: string) {
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

/**
 * E-posta ile şifre sıfırlama tokenı.
 */
export async function generatePasswordResetToken(email: string) {
  return createToken(passwordResetIdentifier(email));
}

/**
 * Telefon ile şifre sıfırlama tokenı (admin-initiated).
 */
export async function generatePasswordResetTokenByPhone(phone: string) {
  return createToken(passwordResetPhoneIdentifier(phone));
}
