import type { Role } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { isAnonymizedEmail } from "@/lib/anonymized-account";
import { WEB_IMPERSONATION_COOKIE, verifyWebImpersonation } from "@/lib/web-impersonation";

export type WebImpersonationView = {
  adminId: string;
  expiresAt: Date;
  target: {
    id: string;
    role: Role;
    name: string | null;
    email: string | null;
    image: string | null;
    emailVerified: Date | null;
  };
};

/**
 * Oturum callback'inin karari. Yalnizca su durumda goruntuleme gecerli:
 * oturum sahibi (jwt callback'inde 60 sn'de bir yeniden dogrulanan) ADMIN, cerez ona
 * basilmis ve suresi dolmamis, adminin ve hedefin `tokenVersion`i degismemis, hedef
 * hala ADMIN degil, yasakli ya da silinmis degil. Aksi her durumda `null`: oturum adminin kendisi.
 */
export async function resolveWebImpersonation(
  token: { sub?: string | null; role?: Role | null; tv?: unknown },
  cookieValue: string | null | undefined,
  now: Date = new Date(),
): Promise<WebImpersonationView | null> {
  if (!cookieValue || !token.sub || token.role !== "ADMIN") return null;
  const claims = await verifyWebImpersonation(cookieValue, { adminId: token.sub, now });
  if (!claims) return null;
  if (typeof token.tv === "number" && token.tv !== claims.adminTv) return null;

  const target = await prisma.user.findUnique({
    where: { id: claims.targetId },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      isBanned: true,
      tokenVersion: true,
    },
  });
  if (!target || target.isBanned || target.role === "ADMIN" || isAnonymizedEmail(target.email)) return null;
  if (target.tokenVersion !== claims.targetTv) return null;

  return {
    adminId: claims.adminId,
    expiresAt: claims.expiresAt,
    target: {
      id: target.id,
      role: target.role,
      name: target.name,
      email: target.email,
      image: target.image && !target.image.startsWith("data:") ? target.image : null,
      emailVerified: target.emailVerified,
    },
  };
}

/** `auth()` istek disinda (build, betik) cagrilirsa `cookies()` firlatir: goruntuleme yok sayilir. */
export async function readWebImpersonation(token: {
  sub?: string | null;
  role?: Role | null;
  tv?: unknown;
}): Promise<WebImpersonationView | null> {
  if (token.role !== "ADMIN") return null;
  let value: string | undefined;
  try {
    const { cookies } = await import("next/headers");
    value = (await cookies()).get(WEB_IMPERSONATION_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!value) return null;
  try {
    return await resolveWebImpersonation(token, value);
  } catch (err) {
    logger.warn({ err }, "web_impersonation_resolve_failed");
    return null;
  }
}
