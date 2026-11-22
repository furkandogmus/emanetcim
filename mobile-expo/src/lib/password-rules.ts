// Sunucu politikasi: ../src/lib/auth-password.ts (MIN/MAX_PASSWORD_LENGTH).
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

/** Yeni sifre sunucunun kabul edecegi uzunlukta mi (bosluk sayilmaz). */
export function isValidNewPassword(password: string): boolean {
  return password.trim().length >= MIN_PASSWORD && password.length <= MAX_PASSWORD;
}
