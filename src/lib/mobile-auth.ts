import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "./db";
import type { Role } from "@prisma/client";

// Basit in-process ban cache: mobil session kontrollerinde her çağrıda DB sorgusu atmaktan kaçınır.
// Serverless ortamında process başına tutulur; 30 saniyelik TTL ile banned kullanıcılar
// en geç 30 saniye içinde engellenir.
const BAN_CACHE_TTL_MS = 30_000;
const banCache = new Map<string, { isBanned: boolean; at: number }>();

async function isBannedCached(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = banCache.get(userId);
  if (cached && now - cached.at < BAN_CACHE_TTL_MS) {
    return cached.isBanned;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true },
  });
  const isBanned = !user || user.isBanned;
  banCache.set(userId, { isBanned, at: now });
  // Cache'in sonsuza büyümesini önle: 500 giriş üzerinde tüm cache'i temizle
  if (banCache.size > 500) banCache.clear();
  return isBanned;
}

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
};

export async function signAccessToken(userId: string, role: Role) {
  return new SignJWT({ role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function signRefreshToken(userId: string, role: Role) {
  return new SignJWT({ role, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(secret());
}

export async function verifyMobileToken(token: string) {
  const { payload } = await jwtVerify(token, secret());
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
    if (await isBannedCached(claims.sub)) return null;
    return {
      userId: claims.sub,
      role: claims.role,
    };
  } catch {
    return null;
  }
}
