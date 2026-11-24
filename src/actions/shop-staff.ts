"use server";

import { getLocale } from "next-intl/server";
import { requireShopAccess, requireUser } from "@/lib/action-auth";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { acceptInvite, inviteStaff, removeStaff, revokeInvite, type InviteResult } from "@/services/ShopStaffService";

/** Hata kodu → `shopStaff` ad alanindaki cevirisi. */
const INVITE_ERROR_KEY: Record<Exclude<InviteResult, { ok: true }>["code"], string> = {
  INVALID_EMAIL: "shopStaff.errorInvalidEmail",
  SELF: "shopStaff.errorSelf",
  OWNER: "shopStaff.errorOwner",
  ALREADY_MEMBER: "shopStaff.errorAlreadyMember",
  LIMIT: "shopStaff.errorLimit",
  RATE_LIMITED: "shopStaff.errorRateLimited",
  NOT_FOUND: "Errors.shopNotFound",
};

function revalidateTeam() {
  revalidatePathAllLocales("/partner/team");
}

export async function inviteShopStaffAction(shopId: string, email: string) {
  const auth = await requireShopAccess(shopId, "manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const result = await inviteStaff({ actor: auth.actor, shopId, email, locale: await getLocale() });
  if (!result.ok) return { success: false as const, error: INVITE_ERROR_KEY[result.code] };
  revalidateTeam();
  return { success: true as const, kind: result.kind };
}

export async function removeShopStaffAction(shopId: string, userId: string) {
  const auth = await requireShopAccess(shopId, "manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  await removeStaff(auth.actor, shopId, userId);
  revalidateTeam();
  return { success: true as const };
}

export async function revokeShopInviteAction(shopId: string, inviteId: string) {
  const auth = await requireShopAccess(shopId, "manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  await revokeInvite(auth.actor, shopId, inviteId);
  revalidateTeam();
  return { success: true as const };
}

export async function acceptShopInviteAction(token: string) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const user = await prisma.user.findUnique({ where: { id: auth.actor.id }, select: { email: true } });
  const result = await acceptInvite(token, { id: auth.actor.id, email: user?.email ?? null });
  if (!result.ok) {
    const key = {
      INVALID: "shopStaff.inviteInvalid",
      EXPIRED: "shopStaff.inviteExpired",
      EMAIL_MISMATCH: "shopStaff.inviteEmailMismatch",
      LIMIT: "shopStaff.errorLimit",
    }[result.code];
    return { success: false as const, error: key };
  }
  revalidatePathAllLocales("/partner");
  return { success: true as const, shopId: result.shopId };
}
