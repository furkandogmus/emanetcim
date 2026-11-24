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

/**
 * Davet yaniti hesabin VARLIGINDAN ve uyelikten BAGIMSIZ: her gecerli adres icin ayni
 * `{ ok: true }`. Sahip zaten ekipte olani uye listesinden gorur. Sahibin ve aktorun
 * kendi adresi icin hata doner (o bilgiyi zaten biliyorlar).
 */
export type InviteResult =
  | { ok: true }
  | {
      ok: false;
      code: "INVALID_EMAIL" | "SELF" | "OWNER" | "LIMIT" | "RATE_LIMITED" | "NOT_FOUND" | "SHOP_INACTIVE" | "CONFLICT";
    };

export type AcceptResult =
  | { ok: true; shopId: string; shopName: string }
  | {
      ok: false;
      code: "INVALID" | "EXPIRED" | "EMAIL_MISMATCH" | "EMAIL_UNVERIFIED" | "LIMIT" | "ALREADY_MEMBER" | "SHOP_INACTIVE" | "CONFLICT";
    };

/** Prisma hata kodu: P2002 tekil ihlali, P2034 serilestirme cakismasi. */
function prismaCode(err: unknown): string | null {
  return typeof err === "object" && err !== null && "code" in err && typeof (err as { code: unknown }).code === "string"
    ? (err as { code: string }).code
    : null;
}

/** Onayli ve acik dukkan: ekip yonetimi yalniz bunlarda (bekleyen basvuru davet atamaz). */
function shopIsLive(shop: { isActive: boolean; approvedAt: Date | null }): boolean {
  return shop.isActive && shop.approvedAt !== null;
}

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

  const [shop, actorRow] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, isActive: true, approvedAt: true, owner: { select: { email: true } } },
    }),
    prisma.user.findUnique({ where: { id: actor.id }, select: { email: true } }),
  ]);
  if (!shop) return { ok: false, code: "NOT_FOUND" };
  if (!shopIsLive(shop)) return { ok: false, code: "SHOP_INACTIVE" };
  if (shop.owner.email?.toLowerCase() === email) return { ok: false, code: "OWNER" };
  if (actorRow?.email?.toLowerCase() === email) return { ok: false, code: "SELF" };

  /*
    HER ZAMAN DAVET YOLU (2026-11-24 QA): hesap varsa dogrudan eklemek, e-postasi
    dogrulanmamis bir on-hesabi (baskasinin adresiyle acilmis) dukkana sokabiliyordu ve
    yanit "hesap var mi" sorusunu cevapliyordu. Zaten uye olan adrese bag gitmez ama
    yanit ayni kalir.
  */
  const alreadyMember = await prisma.shopMember.findFirst({
    where: { shopId, user: { email: { equals: email, mode: "insensitive" } } },
    select: { id: true },
  });
  if (alreadyMember) return { ok: true };

  // Tavan ve yazim TEK serilestirilebilir islemde: iki es zamanli davet 10'u asamaz.
  const token = crypto.randomBytes(32).toString("base64url");
  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const [members, invites] = await Promise.all([
          tx.shopMember.count({ where: { shopId } }),
          tx.shopInvite.count({ where: { ...activeInviteWhere(shopId, now), NOT: { email } } }),
        ]);
        if (members + invites >= MAX_STAFF_PER_SHOP) return false;
        // Ayni adrese tek gecerli davet: yenisi eskisini gecersiz kilar.
        await tx.shopInvite.updateMany({ where: { ...activeInviteWhere(shopId, now), email }, data: { revokedAt: now } });
        await tx.shopInvite.create({
          data: {
            shopId,
            email,
            tokenHash: hashInviteToken(token),
            invitedById: actor.id,
            expiresAt: new Date(now.getTime() + SHOP_INVITE_TTL_MS),
          },
        });
        return true;
      },
      { isolationLevel: "Serializable" },
    );
    if (!created) return { ok: false, code: "LIMIT" };
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2034" || code === "P2002") return { ok: false, code: "CONFLICT" };
    throw err;
  }

  auditIfAdmin(actor, "admin.shop_staff.invite", shopId, { email });
  const link = `${getSiteBaseUrl()}/${locale}/staff-invite?t=${encodeURIComponent(token)}`;
  void notificationService
    .notifyShopStaffInvite({ email, shopName: shop.name, locale, link })
    .catch((err) => logger.error({ err, shopId }, "shop_staff_invite_notify_failed"));
  return { ok: true };
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
 * Daveti oturumdaki hesaba baglar. Bag yalnizca davet edilen E-POSTANIN, DOGRULANMIS
 * hesabinda calisir: iletilen bag ya da baskasinin adresiyle acilmis on-hesap dukkana
 * erisemez. Tek kullanim ve tavan ayni serilestirilebilir islemde.
 */
export async function acceptInvite(
  token: string,
  user: { id: string; email: string | null; emailVerified: boolean },
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
      shop: { select: { name: true, ownerId: true, isActive: true, approvedAt: true } },
    },
  });
  if (!invite || invite.acceptedAt || invite.revokedAt) return { ok: false, code: "INVALID" };
  if (invite.expiresAt <= now) return { ok: false, code: "EXPIRED" };
  if (!user.email || user.email.trim().toLowerCase() !== invite.email) return { ok: false, code: "EMAIL_MISMATCH" };
  if (!user.emailVerified) return { ok: false, code: "EMAIL_UNVERIFIED" };
  if (!shopIsLive(invite.shop)) return { ok: false, code: "SHOP_INACTIVE" };
  const isOwner = invite.shop.ownerId === user.id;

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const { count } = await tx.shopInvite.updateMany({
          where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now, acceptedById: user.id },
        });
        if (count === 0) return "INVALID" as const;
        if (isOwner) return "OK" as const;
        // Bu davetin kendisi tavanda sayiliyordu; simdi uyeye donusuyor.
        const members = await tx.shopMember.count({ where: { shopId: invite.shopId } });
        if (members >= MAX_STAFF_PER_SHOP) throw new LimitReached();
        await tx.shopMember.create({
          data: { shopId: invite.shopId, userId: user.id, invitedById: invite.invitedById },
        });
        return "OK" as const;
      },
      { isolationLevel: "Serializable" },
    );
    if (outcome !== "OK") return { ok: false, code: outcome };
  } catch (err) {
    if (err instanceof LimitReached) return { ok: false, code: "LIMIT" };
    const code = prismaCode(err);
    if (code === "P2002") return { ok: false, code: "ALREADY_MEMBER" };
    if (code === "P2034") return { ok: false, code: "CONFLICT" };
    throw err;
  }
  return { ok: true, shopId: invite.shopId, shopName: invite.shop.name };
}

/** Tavan asilinca islemi geri almak icin (davet kabul edilmis sayilmasin). */
class LimitReached extends Error {}

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
