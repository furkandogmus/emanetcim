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

const secret = () => {
  const s = process.env.MOBILE_JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("MOBILE_JWT_SECRET or AUTH_SECRET must be set");
  return new TextEncoder().encode(s);
};

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

export type MobileJwtClaims = {
  sub: string;
  role: Role;
  type: "access" | "refresh";
  tv?: number; // tokenVersion
};

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
  return new SignJWT({ role, type: "refresh", tv })
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
};

export async function requireMobileUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  }
  const token = header.slice(7);
  try {
    const claims = await verifyMobileToken(token);
    if (claims.type !== "access") throw new Error("bad token type");
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        role: true,
        email: true,
        isBanned: true,
        tokenVersion: true,
      },
    });
    if (!user) throw new Error("user not found");
    if (user.isBanned) throw new Error("user banned");
    if (user.tokenVersion !== (claims.tv ?? 0)) throw new Error("token version mismatch");
    const actor: MobileActor = { id: user.id, role: user.role, email: user.email };
    return { user: actor } as const;
  } catch {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  }
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
