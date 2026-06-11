import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "./db";
import type { Role } from "@prisma/client";

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
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function signRefreshToken(userId: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  return new SignJWT({ role, type: "refresh", tv: user?.tokenVersion ?? 0 })
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
