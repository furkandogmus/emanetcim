import type { Role } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { isAnonymizedEmail } from "@/lib/anonymized-account";
import { inImpersonationReadScope } from "@/lib/impersonation-read-scope";
import {
  WEB_IMPERSONATION_COOKIE,
  WEB_IMPERSONATION_STAMP_HEADER,
  stampMatches,
  verifyWebImpersonation,
} from "@/lib/web-impersonation";

export type WebImpersonationTarget = {
  id: string;
  role: Role;
  name: string | null;
  email: string | null;
  image: string | null;
  emailVerified: Date | null;
};

/**
 * `active`: oturum hedefe doner. `stale`: proxy cerezi dogruladi ama hedef artik
 * gecersiz (yasak, tokenVersion, silinme, ADMIN'e yukselme) ya da admin degisti:
 * oturum adminde kalir, serit yalniz "Cik" gosterir. Proxy yazmayi kestigi icin
 * admin aksi halde 30 dk dugmesiz kilitli kalirdi.
 */
export type WebImpersonationState =
  | { kind: "active"; adminId: string; expiresAt: Date; target: WebImpersonationTarget }
  | { kind: "stale"; expiresAt: Date | null };

type TokenLike = { sub?: string | null; role?: Role | null; tv?: unknown };

export async function resolveWebImpersonation(
  token: TokenLike,
  cookieValue: string,
  now: Date = new Date(),
): Promise<WebImpersonationState> {
  if (!token.sub || token.role !== "ADMIN") return { kind: "stale", expiresAt: null };
  const claims = await verifyWebImpersonation(cookieValue, { adminId: token.sub, now });
  if (!claims) return { kind: "stale", expiresAt: null };
  const stale = { kind: "stale" as const, expiresAt: claims.expiresAt };
  if (typeof token.tv === "number" && token.tv !== claims.adminTv) return stale;

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
  if (!target || target.isBanned || target.role === "ADMIN" || isAnonymizedEmail(target.email)) return stale;
  if (target.tokenVersion !== claims.targetTv) return stale;

  return {
    kind: "active",
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

export type SessionImpersonation =
  | { mode: "target"; adminId: string; expiresAt: Date; target: WebImpersonationTarget }
  /** Okuma kapsami disindaki server action: goruntuleme var ama kimlik yok. */
  | { mode: "anonymous"; adminId: string; expiresAt: Date }
  | { mode: "stale"; expiresAt: Date | null };

/**
 * Oturum callback'inin girdisi. Cerez yoksa ya da proxy damgasi yok/eslesmiyorsa `null`
 * (oturum adminin). `auth()` istek disinda cagrilirsa `headers()` firlatir: yine `null`.
 */
export async function readWebImpersonation(token: TokenLike): Promise<SessionImpersonation | null> {
  let cookie: string | undefined;
  let stamp: string | null = null;
  let isAction = false;
  try {
    const { cookies, headers } = await import("next/headers");
    cookie = (await cookies()).get(WEB_IMPERSONATION_COOKIE)?.value;
    if (!cookie) return null;
    const h = await headers();
    stamp = h.get(WEB_IMPERSONATION_STAMP_HEADER);
    isAction = h.has("next-action");
  } catch {
    return null;
  }
  if (!(await stampMatches(stamp, cookie))) return null;

  let state: WebImpersonationState;
  try {
    state = await resolveWebImpersonation(token, cookie);
  } catch (err) {
    logger.warn({ err }, "web_impersonation_resolve_failed");
    state = { kind: "stale", expiresAt: null };
  }
  if (state.kind === "stale") return { mode: "stale", expiresAt: state.expiresAt };
  if (isAction && !inImpersonationReadScope()) {
    return { mode: "anonymous", adminId: state.adminId, expiresAt: state.expiresAt };
  }
  return { mode: "target", adminId: state.adminId, expiresAt: state.expiresAt, target: state.target };
}
