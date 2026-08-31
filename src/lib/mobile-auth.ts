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

export async function signAccessToken(userId: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  return new SignJWT({ role, type: "access", tv: user?.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.mobile)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function signRefreshToken(userId: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  return new SignJWT({ role, type: "refresh", tv: user?.tokenVersion ?? 0 })
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

export async function requireMobileUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  }
  const token = header.slice(7);
  try {
    const claims = await verifyMobileToken(token);
    if (claims.type !== "access") throw new Error("bad token type");
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) throw new Error("user not found");
    if (user.isBanned) throw new Error("user banned");
    if (user.tokenVersion !== (claims.tv ?? 0)) throw new Error("token version mismatch");
    return { user } as const;
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
    const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { isBanned: true, tokenVersion: true } });
    if (!user) return null;
    if (user.isBanned) return null;
    if (user.tokenVersion !== (claims.tv ?? 0)) return null;
    return {
      userId: claims.sub,
      role: claims.role,
    };
  } catch {
    return null;
  }
}
