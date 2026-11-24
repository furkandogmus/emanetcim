import { SignJWT, jwtVerify } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/lib/jwt-audience";

/**
 * Web "olarak goruntule" (yonetici destek araci), cerez katmani.
 *
 * Yoneticinin kendi Auth.js oturumuna DOKUNULMAZ: hedef kimligi ayri, kisa omurlu,
 * imzali bir cerezde durur. Oturum callback'i (`web-impersonation-session.ts`)
 * cerezi yalnizca oturum sahibi hala ADMIN ise ve cerez O admine basildiysa onurlandirir.
 * Durdurmak = cerezi silmek; yoneticinin oturumu oldugu gibi geri gelir.
 *
 * Bu dosya proxy'den de okunur: Prisma ya da Node'a ozgu modul import etmez.
 */

export const WEB_IMPERSONATION_COOKIE = "bp_imp";
/** Mobil `IMPERSONATION_TTL_SECONDS` ile ayni (test sabitler); uzatilmaz. */
export const WEB_IMPERSONATION_TTL_SECONDS = 30 * 60;

export type WebImpersonationClaims = {
  /** Hedef kullanici. */
  targetId: string;
  /** Hedefin `tokenVersion`i: sifre sifirlama / her yerden cikis goruntulemeyi de bitirir. */
  targetTv: number;
  adminId: string;
  /** Adminin `tokenVersion`i. */
  adminTv: number;
  expiresAt: Date;
};

function authSecret(): string | null {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  // `auth.ts` ile ayni gelistirme yedegi; uretimde sir yoksa ozellik kapali.
  return process.env.NODE_ENV === "development" ? "dev-only-auth-secret-not-for-production" : null;
}

/*
  Ayri turetilmis anahtar: ayni sirla imzalanan diger token aileleri (mobil, QR)
  bu cerez yerine gecemesin, bu cerez de onlarin yerine. `aud` ikinci kilit.
*/
async function cookieKey(): Promise<Uint8Array | null> {
  const s = authSecret();
  if (!s) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`bagajpark.web-impersonation.v1:${s}`));
  return new Uint8Array(digest);
}

export async function isWebImpersonationAvailable(): Promise<boolean> {
  return (await cookieKey()) !== null;
}

export async function signWebImpersonation(input: {
  targetId: string;
  targetTv: number;
  adminId: string;
  adminTv: number;
  now?: Date;
}): Promise<{ token: string; expiresAt: Date } | null> {
  const key = await cookieKey();
  if (!key) return null;
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const exp = nowSec + WEB_IMPERSONATION_TTL_SECONDS;
  const token = await new SignJWT({ adm: input.adminId, tv: input.targetTv, atv: input.adminTv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.webImpersonation)
    .setSubject(input.targetId)
    .setIssuedAt(nowSec)
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: new Date(exp * 1000) };
}

/**
 * Imza, `aud`, sure ve alan bicimi. `adminId` verilirse cerez o admine basilmis olmali
 * (calinan cerez baska oturumda ise yaramaz). Gecersizse `null`, hic firlatmaz.
 */
export async function verifyWebImpersonation(
  token: string | null | undefined,
  opts: { adminId?: string | null; now?: Date } = {},
): Promise<WebImpersonationClaims | null> {
  if (!token) return null;
  const key = await cookieKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.webImpersonation,
      algorithms: ["HS256"],
      currentDate: opts.now,
      requiredClaims: ["exp", "sub"],
    });
    const { sub, adm, tv, atv, exp } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || !sub || typeof adm !== "string" || !adm) return null;
    if (typeof tv !== "number" || typeof atv !== "number" || typeof exp !== "number") return null;
    if (sub === adm) return null;
    if (opts.adminId !== undefined && opts.adminId !== adm) return null;
    return { targetId: sub, targetTv: tv, adminId: adm, adminTv: atv, expiresAt: new Date(exp * 1000) };
  } catch {
    return null;
  }
}

export function webImpersonationCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Disaridan gelen bag goruntuleme oturumunu tasimasin.
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };
}

/** Durdurma ucu: proxy goruntuleme sirasinda yalniz buna ve cikisa yazma izni verir. */
export const WEB_IMPERSONATION_STOP_PATH = "/api/impersonation/stop";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WRITE_ALLOWLIST = new Set([WEB_IMPERSONATION_STOP_PATH, "/api/auth/signout"]);
/** GET olsa da goruntulemede kapali: hedefin tum kisisel verisini indirir. */
const READ_BLOCKLIST = new Set(["/api/account/data-export"]);

export type ImpersonationProxyDecision = "pass" | "clear_cookie" | "block" | "redirect_home";

/**
 * Goruntuleme SALT OKUNUR: web'de ~50 yazma girisi (server action, route handler) var ve
 * hepsinde ortak bir goruntuleme kapisi yok; tek guvenli kapi proxy. Server action'lar da
 * POST oldugu icin buradan gecer.
 */
export function impersonationProxyDecision(input: {
  valid: boolean;
  method: string;
  pathname: string;
  /** Dil oneki atilmis yolun yonetici paneli olup olmadigi. */
  isAdminPath: boolean;
}): ImpersonationProxyDecision {
  if (!input.valid) return "clear_cookie";
  if (WRITE_ALLOWLIST.has(input.pathname)) return "pass";
  if (!SAFE_METHODS.has(input.method.toUpperCase())) return "block";
  if (READ_BLOCKLIST.has(input.pathname)) return "block";
  if (input.isAdminPath) return "redirect_home";
  return "pass";
}
