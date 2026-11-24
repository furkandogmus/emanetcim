import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
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

import { WEB_IMPERSONATION_STOP_PATH, WEB_SIGNOUT_PATH } from "@/lib/web-impersonation-paths";
export { WEB_IMPERSONATION_STOP_PATH, WEB_SIGNOUT_PATH };

/**
 * Proxy'nin "bu istegi dogruladim" damgasi. Oturum callback'i goruntulemeyi YALNIZ bu
 * baslik cerezin HMAC'iyle eslesirse onurlandirir: matcher'in atladigi yollar (nokta
 * iceren yol) ve proxy'yi bypass eden her istek adminin kendi oturumuyla kalir.
 * Gelen istekteki ayni adli baslik proxy'de her zaman silinir.
 */
export const WEB_IMPERSONATION_STAMP_HEADER = "x-bp-imp-ok";

async function stampKey(): Promise<CryptoKey | null> {
  const s = authSecret();
  if (!s) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`bagajpark.web-impersonation-stamp.v1:${s}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function impersonationStamp(cookieValue: string): Promise<string | null> {
  const key = await stampKey();
  if (!key) return null;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(cookieValue)));
  let hex = "";
  for (const b of sig) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export async function stampMatches(stamp: string | null | undefined, cookieValue: string): Promise<boolean> {
  if (!stamp) return false;
  const expected = await impersonationStamp(cookieValue);
  if (!expected || expected.length !== stamp.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ stamp.charCodeAt(i);
  return diff === 0;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
/** GET olsa da goruntulemede kapali: hedefin tum kisisel verisini indirir. */
const READ_BLOCKLIST = new Set(["/api/account/data-export"]);

export type ImpersonationProxyDecision = "pass" | "clear_cookie" | "block" | "redirect_home";

/**
 * Goruntuleme salt okunur. Route handler yazmalari burada kesilir. Server action'lar
 * (`Next-Action` baslikli POST) gecer: kesilirse istemci hata sinirina duser ve aramanin
 * otomatik action'lari sayfayi kirar. Onlarin kilidi oturum callback'inde: okuma kapsami
 * disindaki her action'da kimlik bostur (`impersonation-read-scope.ts`).
 * JS'siz form POST'u (`Next-Action` basliksiz) da kesilir.
 */
export function impersonationProxyDecision(input: {
  valid: boolean;
  method: string;
  pathname: string;
  isServerAction: boolean;
  /** Dil oneki atilmis yolun yonetici paneli olup olmadigi. */
  isAdminPath: boolean;
}): ImpersonationProxyDecision {
  if (!input.valid) return "clear_cookie";
  // Next rotayi cozulmus yolla eslestirir: `data%2Dexport` ham karsilastirmayi atlatmasin.
  const path = normalizeProxyPath(input.pathname);
  if (path === null) return "block";
  if (path === WEB_SIGNOUT_PATH) return "clear_cookie";
  if (path === WEB_IMPERSONATION_STOP_PATH) return "pass";
  const method = input.method.toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    // Server action `/api`ye hic gitmez: orada `Next-Action` basligi sahtedir.
    const isApi = path === "/api" || path.startsWith("/api/");
    return method === "POST" && input.isServerAction && !isApi ? "pass" : "block";
  }
  if (READ_BLOCKLIST.has(path)) return "block";
  if (input.isAdminPath) return "redirect_home";
  return "pass";
}

/** Cozulmus, sondaki `/` atilmis, kucuk harf yol; cozulemeyen kodlama `null` (engellenir). */
export function normalizeProxyPath(pathname: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  p = p.replace(/\/+/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLowerCase();
}

/**
 * Proxy kapisi. `authUser` proxy'nin Auth.js oturumudur (`auth.config.ts`); kimlik `id`
 * yoksa `sub`'dan gelir (gercek token'da `id` yok). Gecerli cerezde damga doner.
 */
export async function impersonationGate(input: {
  cookie: string | undefined;
  authUser: { id?: string | null; role?: string | null } | null | undefined;
  method: string;
  pathname: string;
  isServerAction: boolean;
  isAdminPath: boolean;
  now?: Date;
}): Promise<{ decision: ImpersonationProxyDecision | "none"; stamp: string | null }> {
  if (!input.cookie) return { decision: "none", stamp: null };
  const adminId = input.authUser?.role === "ADMIN" && input.authUser.id ? input.authUser.id : null;
  const valid = adminId ? (await verifyWebImpersonation(input.cookie, { adminId, now: input.now })) !== null : false;
  const decision = impersonationProxyDecision({ ...input, valid });
  const stamp = valid && decision !== "clear_cookie" ? await impersonationStamp(input.cookie) : null;
  return { decision, stamp };
}

/**
 * Istek basligi degisikligi ayarlanmamis bir `next()` yanitina eklenir; boylece istemcinin
 * gonderdigi damga hicbir daldan uygulamaya ulasmaz. Zaten ayarli yanit (intl, `/api`) dokunulmaz.
 */
export function withForwardedHeaders(res: NextResponse, overrideHeaders: Headers | null): NextResponse {
  if (!overrideHeaders || res.headers.has("x-middleware-override-headers")) return res;
  const carrier = NextResponse.next({ request: { headers: overrideHeaders } });
  for (const [k, v] of carrier.headers) {
    if (k === "x-middleware-override-headers" || k.startsWith("x-middleware-request-")) res.headers.set(k, v);
  }
  return res;
}
