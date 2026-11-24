"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db";
import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import {
  WEB_IMPERSONATION_COOKIE,
  isWebImpersonationAvailable,
  signWebImpersonation,
  webImpersonationCookieOptions,
} from "@/lib/web-impersonation";
import { adminUserService } from "@/services/AdminUserService";

export type StartImpersonationResult =
  | { ok: true; expiresAt: string }
  | { ok: false; error: string };

/**
 * Web "olarak goruntule" (30 dk, salt okunur). Kural ve `admin.impersonate.start` kaydi
 * mobil uc ile ortak `AdminUserService.startImpersonation`ta; burada yalniz cerez basilir.
 * Goruntuleme sirasinda `requireAdmin` hedefin rolunu gorur, yani zincirleme baslatma olmaz.
 */
export async function startImpersonationAction(rawUserId: unknown): Promise<StartImpersonationResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = z.string().uuid().safeParse(rawUserId);
  if (!parsed.success) return { ok: false, error: "Errors.invalidData" };
  if (!(await isWebImpersonationAvailable())) return { ok: false, error: "unavailable" };

  const admin = await prisma.user.findUnique({ where: { id: auth.actor.id }, select: { tokenVersion: true } });
  if (!admin) return { ok: false, error: "Errors.authRequired" };

  const result = await adminUserService.startImpersonation(parsed.data, {
    userId: auth.actor.id,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) return { ok: false, error: result.error };

  const signed = await signWebImpersonation({
    targetId: result.target.id,
    targetTv: result.target.tokenVersion,
    adminId: auth.actor.id,
    adminTv: admin.tokenVersion,
  });
  if (!signed) return { ok: false, error: "unavailable" };
  (await cookies()).set(WEB_IMPERSONATION_COOKIE, signed.token, webImpersonationCookieOptions(signed.expiresAt));
  return { ok: true, expiresAt: signed.expiresAt.toISOString() };
}
