import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Veritabaninda duz metin durmamasi gereken kucuk sirlar icin AES-256-GCM zarfi
 * (2026-11-23, ilk kullanim: Apple refresh token'i).
 *
 * Anahtar `APPLE_TOKEN_ENCRYPTION_KEY` ortam degiskeninden okunur: 32 bayt,
 * base64 (`openssl rand -base64 32`). Tanimsiz ya da bozuksa `loadSealKey` null
 * doner ve cagiran HICBIR SEY SAKLAMAZ: anahtarsiz duz metin saklamak, bu
 * dosyanin var olma sebebini bosa cikarir.
 *
 * Bicim: `v1.<iv>.<tag>.<sifreli>` (base64url). Surum oneki, anahtar ya da
 * algoritma degisirse eski satirlari ayirt etmek icin.
 */
export const SEAL_KEY_ENV = "APPLE_TOKEN_ENCRYPTION_KEY";

const PREFIX = "v1";

export function loadSealKey(raw: string | undefined = process.env[SEAL_KEY_ENV]): Buffer | null {
  const v = raw?.trim();
  if (!v) return null;
  const key = Buffer.from(v, "base64");
  return key.length === 32 ? key : null;
}

export function isSealed(value: string): boolean {
  return value.startsWith(`${PREFIX}.`) && value.split(".").length === 4;
}

export function sealSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Yanlis anahtar, bozuk ya da kurcalanmis zarf -> null (firlatmaz). */
export function unsealSecret(sealed: string, key: Buffer): string | null {
  if (!isSealed(sealed)) return null;
  const [, iv, tag, ct] = sealed.split(".");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
