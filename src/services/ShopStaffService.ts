import crypto from "crypto";
import { z } from "zod";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";
import { getSiteBaseUrl } from "@/lib/site-base-url";
import { notificationService } from "@/services/NotificationService";

/**
 * Dukkan ekibi: personel ekleme/cikarma ve e-posta daveti. Yetki (`manage`) CAGIRANDA
 * (`requireShopAccess` / `assertShopAccess`); bu servis yalnizca ekip kurallarini tasir.
 * Web action'i ve mobil uc ayni fonksiyonlari cagirir.
 */

/** Dukkan basina personel + bekleyen davet tavani. */
export const MAX_STAFF_PER_SHOP = 10;
export const SHOP_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Davet eden basina saatlik tavan: e-posta bombalamasi ve hesap var mi taramasi. */
export const INVITES_PER_HOUR = 20;

export type StaffActor = { id: string; role: string };

export type InviteResult =
  | { ok: true; kind: "added" | "invited" }
  | {
      ok: false;
      code: "INVALID_EMAIL" | "SELF" | "OWNER" | "ALREADY_MEMBER" | "LIMIT" | "RATE_LIMITED" | "NOT_FOUND";
    };

export type AcceptResult =
  | { ok: true; shopId: string; shopName: string }
  | { ok: false; code: "INVALID" | "EXPIRED" | "EMAIL_MISMATCH" | "LIMIT" };

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

function activeInviteWhere(shopId: string, now: Date) {
  return { shopId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

function auditIfAdmin(actor: StaffActor, action: string, shopId: string, metadata: Record<string, string>) {
  if (actor.role !== "ADMIN") return;
  writeAuditLog({ actorUserId: actor.id, actorRole: "ADMIN", action, entityType: "Shop", entityId: shopId, metadata });
}

export async function listTeam(shopId: string, now: Date = new Date()) {
  const [members, invites] = await Promise.all([
    prisma.shopMember.findMany({
      where: { shopId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, role: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.shopInvite.findMany({
      where: activeInviteWhere(shopId, now),
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, expiresAt: true, createdAt: true },
    }),
  ]);
  return { members, invites, limit: MAX_STAFF_PER_SHOP };
}

export async function inviteStaff(params: {
  actor: StaffActor;
  shopId: string;
  email: unknown;
  locale: string;
  now?: Date;
}): Promise<InviteResult> {
  const { actor, shopId, locale } = params;
  const now = params.now ?? new Date();
  const parsed = emailSchema.safeParse(params.email);
  if (!parsed.success) return { ok: false, code: "INVALID_EMAIL" };
  const email = parsed.data;

  if (!(await rateLimit(`shop_staff_invite:${actor.id}`, INVITES_PER_HOUR, 60 * 60_000))) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, name: true, ownerId: true, owner: { select: { email: true } } },
  });
  if (!shop) return { ok: false, code: "NOT_FOUND" };
  if (shop.owner.email?.toLowerCase() === email) return { ok: false, code: "OWNER" };

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (user?.id === actor.id) return { ok: false, code: "SELF" };
  if (user?.id === shop.ownerId) return { ok: false, code: "OWNER" };
  if (user) {
    const existing = await prisma.shopMember.findUnique({
      where: { shopId_userId: { shopId, userId: user.id } },
      select: { id: true },
    });
    if (existing) return { ok: false, code: "ALREADY_MEMBER" };
  }

  const [memberCount, inviteCount] = await Promise.all([
    prisma.shopMember.count({ where: { shopId } }),
    prisma.shopInvite.count({ where: { ...activeInviteWhere(shopId, now), NOT: { email } } }),
  ]);
  if (memberCount + inviteCount >= MAX_STAFF_PER_SHOP) return { ok: false, code: "LIMIT" };

  if (user) {
    await prisma.shopMember.create({ data: { shopId, userId: user.id, invitedById: actor.id } });
    await prisma.shopInvite.updateMany({ where: { ...activeInviteWhere(shopId, now), email }, data: { revokedAt: now } });
    auditIfAdmin(actor, "admin.shop_staff.add", shopId, { userId: user.id });
    void notificationService
      .notifyShopStaffInvite({ email, shopName: shop.name, locale, userId: user.id })
      .catch((err) => logger.error({ err, shopId }, "shop_staff_added_notify_failed"));
    return { ok: true, kind: "added" };
  }

  // Ayni adrese tek gecerli davet: yenisi eskisini gecersiz kilar (eski bag olu kalir).
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.shopInvite.updateMany({ where: { ...activeInviteWhere(shopId, now), email }, data: { revokedAt: now } }),
    prisma.shopInvite.create({
      data: {
        shopId,
        email,
        tokenHash: hashInviteToken(token),
        invitedById: actor.id,
        expiresAt: new Date(now.getTime() + SHOP_INVITE_TTL_MS),
      },
    }),
  ]);
  auditIfAdmin(actor, "admin.shop_staff.invite", shopId, { email });
  const link = `${getSiteBaseUrl()}/${locale}/staff-invite?t=${encodeURIComponent(token)}`;
  void notificationService
    .notifyShopStaffInvite({ email, shopName: shop.name, locale, link })
    .catch((err) => logger.error({ err, shopId }, "shop_staff_invite_notify_failed"));
  return { ok: true, kind: "invited" };
}

/** Personeli cikarir. Yetki her istekte tablodan okundugu icin erisim o an biter. */
export async function removeStaff(actor: StaffActor, shopId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.shopMember.deleteMany({ where: { shopId, userId } });
  if (count > 0) auditIfAdmin(actor, "admin.shop_staff.remove", shopId, { userId });
  return count > 0;
}

export async function revokeInvite(actor: StaffActor, shopId: string, inviteId: string): Promise<boolean> {
  const { count } = await prisma.shopInvite.updateMany({
    where: { id: inviteId, shopId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count > 0) auditIfAdmin(actor, "admin.shop_staff.revoke_invite", shopId, { inviteId });
  return count > 0;
}

/**
 * Daveti oturumdaki hesaba baglar. Bag yalnizca davet edilen E-POSTANIN hesabinda
 * calisir: iletilen/sizan bag baska bir hesaba dukkan erisimi vermez. Tek kullanim
 * kosullu `updateMany` ile: iki es zamanli kabulden yalniz biri gecer.
 */
export async function acceptInvite(
  token: string,
  user: { id: string; email: string | null },
  now: Date = new Date(),
): Promise<AcceptResult> {
  if (!token || token.length > 200) return { ok: false, code: "INVALID" };
  const invite = await prisma.shopInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      shopId: true,
      email: true,
      acceptedAt: true,
      revokedAt: true,
      expiresAt: true,
      invitedById: true,
      shop: { select: { name: true, ownerId: true } },
    },
  });
  if (!invite || invite.acceptedAt || invite.revokedAt) return { ok: false, code: "INVALID" };
  if (invite.expiresAt <= now) return { ok: false, code: "EXPIRED" };
  if (!user.email || user.email.trim().toLowerCase() !== invite.email) return { ok: false, code: "EMAIL_MISMATCH" };

  const already = await prisma.shopMember.findUnique({
    where: { shopId_userId: { shopId: invite.shopId, userId: user.id } },
    select: { id: true },
  });
  if (!already && invite.shop.ownerId !== user.id) {
    // Davetin kendisi tavanda sayiliyordu; uye olunca sayim uyeye gecer.
    const members = await prisma.shopMember.count({ where: { shopId: invite.shopId } });
    if (members >= MAX_STAFF_PER_SHOP) return { ok: false, code: "LIMIT" };
  }

  const claimed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.shopInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedById: user.id },
    });
    if (count === 0) return false;
    if (!already && invite.shop.ownerId !== user.id) {
      await tx.shopMember.create({
        data: { shopId: invite.shopId, userId: user.id, invitedById: invite.invitedById },
      });
    }
    return true;
  });
  if (!claimed) return { ok: false, code: "INVALID" };
  return { ok: true, shopId: invite.shopId, shopName: invite.shop.name };
}

/** Davet sayfasi icin: bag gecerli mi, hangi dukkan (oturum acmadan once gosterilir). */
export async function peekInvite(token: string, now: Date = new Date()) {
  if (!token || token.length > 200) return null;
  const invite = await prisma.shopInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: { acceptedAt: true, revokedAt: true, expiresAt: true, shop: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.revokedAt) return { status: "invalid" as const };
  if (invite.expiresAt <= now) return { status: "expired" as const };
  return { status: "valid" as const, shopName: invite.shop.name };
}
