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
 * - Mevcut sifre VARSA dogrulanir; yoksa istenmez (OTP/Google ile acilmis hesap).
 * - Ilk sifre de degisim gibi `tokenVersion`i artirir: calinmis bir oturum
 *   sessizce kalici kimlik bilgisi koyup ayakta kalamasin (2026-11-24 guvenlik
 *   incelemesi). Cagiran yeni token ciftini kullanir; ilk sifrede sahibine
 *   `sendPasswordSetNotice` gider.
 * - Yonetici goruntuleme oturumunda cagrilmaz (mobil uc 403 doner); sifresiz
 *   esnafa erisim icin yonetici sifirlama bagini (72 saat) uretir.
 */
export type SetOwnPasswordResult =
  | { ok: true; tokenVersion: number; firstPassword: boolean }
  | {
      ok: false;
      reason: "invalid_password" | "current_password_required" | "invalid_current_password" | "not_found";
    };

export async function setOwnPassword(params: {
  userId: string;
  currentPassword?: string;
  newPassword: string;
}): Promise<SetOwnPasswordResult> {
  const { userId, currentPassword, newPassword } = params;
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
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return { ok: false, reason: "invalid_current_password" };
    }
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return { ok: true, tokenVersion: updated.tokenVersion, firstPassword: user.passwordHash === null };
}
