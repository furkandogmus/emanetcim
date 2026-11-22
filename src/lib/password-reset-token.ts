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

/** E-posta ile istenen sıfırlama bağı: 1 saat. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
/**
 * Yalnızca ADMİN'in esnafa elden (WhatsApp) ilettiği bağ: 72 saat. Esnaf teknik değil ve
 * mesajı vardiya sonunda açabiliyor; 1 saatlik bağ okunmadan ölüyor, admin yeniden üretiyordu.
 */
export const PARTNER_RESET_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * Token oluşturur (varsayılan 1 saat). Aynı identifier için önceki token varsa silinir.
 */
async function createToken(identifier: string, ttlMs: number = PASSWORD_RESET_TTL_MS) {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + ttlMs);

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
export async function generatePasswordResetTokenByPhone(phone: string, ttlMs: number = PASSWORD_RESET_TTL_MS) {
  return createToken(passwordResetPhoneIdentifier(phone), ttlMs);
}

/**
 * Sıfırlama bağının ait olduğu hesabın giriş kimliği (e-posta ya da telefon).
 *
 * Yalnızca şifre yöneticisi için: yeni şifre formuna gizli bir `username`
 * alanı olarak konur ki tarayıcı şifreyi DOĞRU hesaba kaydetsin (yoksa kimliksiz
 * bir kayıt açıyor ya da başka bir hesabın şifresini eziyordu). Bağı elinde
 * tutan kişi zaten o hesabın sahibi; geçersiz/süresi dolmuş bağda `null`.
 */
export async function resolvePasswordResetLogin(token: string): Promise<string | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const row = await prisma.verificationToken.findUnique({ where: { token: trimmed } });
  if (!row || row.expires.getTime() < Date.now()) return null;
  if (isPhoneResetIdentifier(row.identifier)) {
    return row.identifier.slice(PASSWORD_RESET_PHONE_PREFIX.length) || null;
  }
  if (row.identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)) {
    return row.identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length) || null;
  }
  return null;
}
