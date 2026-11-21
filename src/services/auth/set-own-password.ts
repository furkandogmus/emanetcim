import prisma from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth-password";

/**
 * Kullanicinin kendi sifresini belirlemesi / degistirmesi (profil ekrani).
 *
 * Neden var: esnafin bir kismi e-postasiz, SMS yok, "sifremi unuttum" e-posta
 * istiyor. Yonetici "kullanici olarak goruntule" ile esnafin profiline girip bu
 * ekrandan sifre koyar; OTP/Google ile acilmis (sifresiz) hesaplar da ayni
 * yoldan sifre kazanir.
 *
 * - Mevcut sifre VARSA dogrulanir; yoksa istenmez.
 * - Sifre degisimi `tokenVersion`i artirir (eski oturumlar duser) ve cagiran
 *   yeni token ciftini kullanir. Goruntuleme oturumunda artirilmaz: yonetici
 *   oturumu kaybetmesin; sifresiz hesapta zaten dusurulecek oturum yok.
 */
export type SetOwnPasswordResult =
  | { ok: true; tokenVersion: number; rotated: boolean }
  | {
      ok: false;
      reason: "invalid_password" | "current_password_required" | "invalid_current_password" | "not_found";
    };

export async function setOwnPassword(params: {
  userId: string;
  currentPassword?: string;
  newPassword: string;
  impersonating?: boolean;
}): Promise<SetOwnPasswordResult> {
  const { userId, currentPassword, newPassword, impersonating = false } = params;
  if (
    typeof newPassword !== "string" ||
    newPassword.trim().length < MIN_PASSWORD_LENGTH ||
    newPassword.length > MAX_PASSWORD_LENGTH
  ) {
    return { ok: false, reason: "invalid_password" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, tokenVersion: true },
  });
  if (!user) return { ok: false, reason: "not_found" };

  if (user.passwordHash) {
    if (!currentPassword) return { ok: false, reason: "current_password_required" };
    // Goruntuleme oturumunda mevcut sifreyi yonetici bilemez; kural yine de ayni:
    // sifreli hesapta mevcut sifre sart (yonetici sifresizse koyar, sifreliyse kullanici degistirir).
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return { ok: false, reason: "invalid_current_password" };
    }
  }

  const passwordHash = await hashPassword(newPassword);
  const rotate = !impersonating && user.passwordHash !== null;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: rotate ? { passwordHash, tokenVersion: { increment: 1 } } : { passwordHash },
    select: { tokenVersion: true },
  });
  return { ok: true, tokenVersion: updated.tokenVersion, rotated: rotate };
}
