import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "./db";
import type { Role } from "@prisma/client";
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  audienceAllows,
  hasForeignClaims,
} from "./jwt-audience";
import { writeAuditLog } from "./audit-log";
import logger from "./logger";

const secret = () => {
  const s = process.env.MOBILE_JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("MOBILE_JWT_SECRET or AUTH_SECRET must be set");
  return new TextEncoder().encode(s);
};

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";
/** Yonetici "kullanici olarak gir" oturumu; yenilenmez, sure dolunca admin yeniden baslatir. */
export const IMPERSONATION_TTL_SECONDS = 30 * 60;

export type MobileJwtClaims = {
  sub: string;
  role: Role;
  type: "access" | "refresh";
  tv?: number; // tokenVersion
  /** Yalniz refresh token'larda: tekrar-kullanim (replay) tespiti icin -- bkz. refresh-token-store.ts. */
  jti?: string;
  /** Yalniz yonetici goruntuleme token'larinda: oturumu baslatan ADMIN'in id'si. */
  imp?: string;
  /** Goruntuleme token'inda ADMIN'in `tokenVersion`i: admin "her yerden cikis" yapinca goruntuleme de biter. */
  impTv?: number;
};

/**
 * Yonetici destek oturumu: hedefin access token'i + `imp` (admin id). Refresh token
 * BILEREK yok; `requireMobileUser` her istekte admini yeniden dogrular.
 */
export async function signImpersonationToken(
  targetUserId: string,
  role: Role,
  adminId: string,
  tokenVersion?: number,
  adminTokenVersion?: number,
) {
  const tv = await resolveTokenVersion(targetUserId, tokenVersion);
  const impTv = await resolveTokenVersion(adminId, adminTokenVersion);
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000);
  const token = await new SignJWT({ role, type: "access", tv, imp: adminId, impTv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.mobile)
    .setSubject(targetUserId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  return { token, expiresAt };
}

/**
 * `tokenVersion` cagirandan GECIRILEBILIR (2026-08-31).
 *
 * NEDEN: her giris yolu once kullaniciyi buluyor, sonra iki token uretiyordu ve
 * imzalayicilarin HER BIRI ayni kullaniciyi bir kez daha sorguluyordu -- yani
 * tek bir girise UC `user` sorgusu dusuyordu. `tokenVersion` cagiranin elinde
 * zaten var; iki gereksiz gidis-donus.
 *
 * Parametre ISTEGE BAGLI: gecilmezse eski davranis (sorgula) surer, yani
 * cagiran taraflari tek tek gecirmek zorunda birakmadan duzeliyor.
 */
async function resolveTokenVersion(
  userId: string,
  known?: number,
): Promise<number> {
  if (typeof known === "number") return known;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  return user?.tokenVersion ?? 0;
}

export async function signAccessToken(userId: string, role: Role, tokenVersion?: number) {
  const tv = await resolveTokenVersion(userId, tokenVersion);
  return new SignJWT({ role, type: "access", tv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.mobile)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function signRefreshToken(userId: string, role: Role, tokenVersion?: number) {
  const tv = await resolveTokenVersion(userId, tokenVersion);
  // `jti`: bkz. refresh-token-store.ts -- tekrar-kullanim (replay) tespiti bu alana dayanir.
  return new SignJWT({ role, type: "refresh", tv, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.mobile)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(secret());
}

/**
 * AILE SINIRI (2026-08-31) — gerekcesi `src/lib/jwt-audience.ts`'te. Ayni sir
 * QR ve misafir sorgu token'larini da imzaliyor; `bookingId`/`email` tasiyan
 * bir govde mobil oturum token'i DEGILDIR. `type` kontrolu cagiranlarda
 * ("access" / "refresh") zaten var, bu onun tamamlayicisi.
 *
 * FIRLATIR: cagiranlarin hepsi zaten `try`/`catch` icinde ve yakalayinca 401
 * donuyor -- gecersiz token'in tek bir cikis yolu olsun.
 */
export async function verifyMobileToken(token: string) {
  const { payload } = await jwtVerify(token, secret());
  if (!audienceAllows(payload.aud, JWT_AUDIENCE.mobile)) {
    throw new Error("audience mismatch");
  }
  if (hasForeignClaims(payload as Record<string, unknown>, ["bookingId", "email", "guestId", "shopId"])) {
    throw new Error("foreign token claims");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("missing subject");
  }
  return payload as unknown as MobileJwtClaims & { exp: number };
}

/**
 * Yetkili mobil isteklerin TASIDIGI kimlik. Tam `User` satiri DEGIL.
 *
 * NEDEN DARALTILDI (2026-08-31'de olculdu): onceki hali `findUnique` cagrisini
 * `select` OLMADAN yapiyordu, yani HER yetkili mobil istekte butun `User`
 * satirini cekiyordu. Iki ayri bedeli vardi:
 *
 *   1. **`image` alani bir base64 data URL.** `/api/mobile/auth/me` yuklenen
 *      avatari 2 MB'a kadar kabul edip `data:image/...;base64,...` olarak bu
 *      sutuna yaziyor -- base64 sisirmesiyle ~2,7 MB. Yani avatar yuklemis bir
 *      kullanicinin HER istegi, hicbir ucun okumadigi megabaytlarca metni
 *      Postgres'ten cekiyordu. (`auth.config.ts` icinde JWT'den `data:`
 *      goruntulerini ayiklayan bir yama zaten var; ayni sorunun cerez
 *      tarafindaki yuzu.)
 *   2. **`passwordHash` istek nesnesine giriyordu.** Hicbir uc onu yanita
 *      koymuyor (`toMobileDto` alan listesi kapiyor) ama orada durmasi
 *      gereksiz: bir gun biri `NextResponse.json(auth.user)` yazarsa bcrypt
 *      hash'i disari cikar.
 *
 * Uclarin GERCEKTEN okudugu alanlar tarandi: `id`, `role`, `email`. Profil
 * gövdesine ihtiyaci olan tek uc (`auth/me` GET) kendi sorgusunu yapiyor.
 */
export type MobileActor = {
  id: string;
  role: Role;
  email: string | null;
  /** Bir yonetici bu kullanici olarak goruntuluyorsa o yoneticinin id'si. */
  impersonatedBy?: string;
};

/** Yonetici goruntuleme oturumunda kapali uclar (hesap silme, push kaydi, cikis iptali). */
export function forbidWhileImpersonating(user: MobileActor) {
  if (!user.impersonatedBy) return null;
  return NextResponse.json({ error: "not_allowed_while_impersonating" }, { status: 403 });
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * Veritabani/Redis hatasi. 401 DEGIL: istemci 401'de token'lari silip
 * kullaniciyi cikisa atar, 5xx'i ise gecici ag hatasi sayar ve oturumu korur.
 */
export function serviceUnavailable() {
  return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
}

type ActorRow = { id: string; role: Role; email: string | null; isBanned: boolean; tokenVersion: number };

export async function requireMobileUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return { error: unauthorized() } as const;
  const token = header.slice(7);

  let claims: Awaited<ReturnType<typeof verifyMobileToken>>;
  try {
    claims = await verifyMobileToken(token);
  } catch {
    return { error: unauthorized() } as const;
  }
  if (claims.type !== "access") return { error: unauthorized() } as const;
  // Yetkisi alinan ya da yasaklanan yonetici acik goruntuleme oturumunu da aninda kaybeder.
  if (claims.imp !== undefined && (typeof claims.imp !== "string" || !claims.imp)) {
    return { error: unauthorized() } as const;
  }

  let user: ActorRow | null;
  let admin: { role: Role; isBanned: boolean; tokenVersion: number } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, email: true, isBanned: true, tokenVersion: true },
    });
    if (user && claims.imp) {
      admin = await prisma.user.findUnique({
        where: { id: claims.imp },
        select: { role: true, isBanned: true, tokenVersion: true },
      });
    }
  } catch (err) {
    logger.warn({ err }, "mobile_auth_db_unavailable");
    return { error: serviceUnavailable() } as const;
  }

  if (!user || user.isBanned || user.tokenVersion !== (claims.tv ?? 0)) return { error: unauthorized() } as const;
  const actor: MobileActor = { id: user.id, role: user.role, email: user.email };
  if (claims.imp) {
    // Oturum suresince ADMIN'e yukseltilen hedef de goruntulenemez.
    if (user.role === "ADMIN") return { error: unauthorized() } as const;
    if (!admin || admin.role !== "ADMIN" || admin.isBanned) return { error: unauthorized() } as const;
    // `impTv` tasimayan (bu degisiklikten once basilmis) token da reddedilir: en fazla 30 dk'lik oturum.
    if (admin.tokenVersion !== claims.impTv) return { error: unauthorized() } as const;
    actor.impersonatedBy = claims.imp;
    if (req.method !== "GET" && req.method !== "HEAD") {
      writeAuditLog({
        actorUserId: claims.imp,
        actorRole: "ADMIN",
        action: "admin.impersonate.request",
        entityType: "User",
        entityId: user.id,
        metadata: { method: req.method, path: new URL(req.url).pathname },
      });
    }
  }
  return { user: actor } as const;
}

export function requireRole(user: { role: Role }, roles: Role[]) {
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function getMobileSession() {
  const { headers } = await import("next/headers");
  const h = await headers();
  const authHeader = h.get("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const claims = await verifyMobileToken(token);
    if (claims.type !== "access") return null;
    // Bu yardimciyi web yonetici uclari kullaniyor; goruntuleme token'i orada hic gecmez.
    if (claims.imp !== undefined) return null;
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { role: true, isBanned: true, tokenVersion: true },
    });
    if (!user) return null;
    if (user.isBanned) return null;
    if (user.tokenVersion !== (claims.tv ?? 0)) return null;
    /*
      ROL VERITABANINDAN OKUNUR (2026-08-31'de duzeltildi).

      Onceki hali `claims.role` donduruyordu, yani TOKEN'da yazan rolu. Kardesi
      `requireMobileUser` ayni bilgiyi veritabanindan okuyor -- iki yardimci ayni
      soruya iki farkli kaynaktan yanit veriyordu. Bu yardimciyi kullanan uclar
      web yonetici uclari (`/api/admin/applications`, `/api/admin/messages`),
      yani farkin en pahaliya patlayacagi yer: yetkisi alinmis bir yoneticinin
      elindeki token'da hâlâ `role: "ADMIN"` yaziyor ve bu uclar ona inaniyordu.
    */
    return {
      userId: claims.sub,
      role: user.role,
    };
  } catch {
    return null;
  }
}
