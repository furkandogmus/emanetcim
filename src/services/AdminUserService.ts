import { Role, type Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { phoneSearchDigits } from "@/lib/admin-phone-search";
import { cursorArgs, toPage } from "@/lib/cursor-page";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { isAnonymizedEmail } from "@/lib/anonymized-account";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { requestPasswordReset } from "@/services/auth/password-reset";

export type AdminActor = { userId: string | null; ip: string | null };

export type ChangeRoleResult =
  | { ok: true; status: "applied" | "pending_approval" }
  | {
      ok: false;
      error: "not_found" | "cannot_change_self" | "same_role" | "pending_exists" | "cannot_demote_sole_admin";
    };

export type AdminMailResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "no_email" | "invalid_email" | "already_verified" };

/** Anonimlestirilmis hesabin e-postasi (`gdpr_...@invalid.local`) gercek bir adres degil. */
function usableEmail(email: string | null): string | null {
  const v = email?.trim();
  if (!v || isAnonymizedEmail(v)) return null;
  return v;
}

const LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isBanned: true,
  isTest: true,
  createdAt: true,
  _count: { select: { bookings: true, shops: true } },
} as const satisfies Prisma.UserSelect;

function userSearchWhere(q: string): Prisma.UserWhereInput | undefined {
  const term = q.trim();
  if (!term) return undefined;
  // Telefon: bosluk/tire/+90/0 onekleri ne olursa olsun saklanan bicimle eslesir.
  const digits = phoneSearchDigits(term, 4);
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ],
  };
}

export class AdminUserService {
  /** Ad, e-posta ya da telefonla arama; bos sorgu en yeni kullanicilari verir. */
  async search(q: string, take = 50) {
    return prisma.user.findMany({
      where: userSearchWhere(q),
      orderBy: { createdAt: "desc" },
      take,
      select: LIST_SELECT,
    });
  }

  /** `search`'un sayfali hali: bos sorgu en yeni 50'de bitiyor, devamina ulasilamiyordu. */
  async searchPage(q: string, opts: { cursor?: string | null; take?: number } = {}) {
    const take = Math.min(Math.max(1, opts.take ?? 50), 100);
    const rows = await prisma.user.findMany({
      where: userSearchWhere(q),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(opts.cursor ?? null, take),
      select: LIST_SELECT,
    });
    return toPage(rows, take);
  }

  /*
    Yasaklama `tokenVersion`i da artirir: acik web oturumu ve mobil token'lar
    aninda duser. Kendini yasaklamak reddedilir: tek admin kendini kilitlerdi.
  */
  async setBanned(
    userId: string,
    isBanned: boolean,
    actor: AdminActor,
  ): Promise<{ ok: true } | { ok: false; error: "not_found" | "cannot_ban_self" | "cannot_ban_admin" }> {
    if (actor.userId != null && actor.userId === userId && isBanned) {
      return { ok: false, error: "cannot_ban_self" };
    }
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!exists) return { ok: false, error: "not_found" };
    // Yonetici yetkisi iki admin onayli akistan gider; yasak bunun yan kapisi olmasin.
    if (isBanned && exists.role === "ADMIN") return { ok: false, error: "cannot_ban_admin" };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isBanned, tokenVersion: { increment: 1 } },
      }),
      // Oturumu dusen yasakli hesabin cihazlari bildirim de almasin (bkz. `revokeAllUserSessions`).
      ...(isBanned ? [prisma.mobilePushToken.deleteMany({ where: { userId } })] : []),
    ]);
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.ban_toggle",
      entityType: "User",
      entityId: userId,
      metadata: { isBanned },
      ip: actor.ip,
    });
    return { ok: true };
  }

  /*
    "Bu kullanici olarak gir" (destek). Kural burada, token'i uc imzalar.
    ADMIN hedef reddedilir: bir yonetici digerinin yetkisini devralmamali.
  */
  async startImpersonation(targetId: string, actor: AdminActor) {
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        image: true,
        emailVerified: true,
        passwordHash: true,
        isBanned: true,
        tokenVersion: true,
      },
    });
    if (!target) return { ok: false, error: "not_found" } as const;
    if (target.role === "ADMIN") return { ok: false, error: "cannot_impersonate_admin" } as const;
    if (target.isBanned) return { ok: false, error: "user_banned" } as const;

    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "admin.impersonate.start",
      entityType: "User",
      entityId: target.id,
      ip: actor.ip,
    });
    return { ok: true, target } as const;
  }

  /* ===================== Kullanici yonetimi (web + mobil admin) ===================== */

  /** Mobil kullanici detayi: liste satiri + dogrulama, sifre ve bekleyen rol istegi. */
  async getDetail(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...LIST_SELECT,
        emailVerified: true,
        passwordHash: true,
        adminRoleChangeTargets: { select: { requestedRole: true } },
      },
    });
  }

  /*
    ROL DEGISIKLIGI -- govde 2026-11-23'te `submitAdminRoleChangeAction`tan tasindi;
    mobil admin ucu da ayni kurali cagirir. Kurallar:
      - kendi rolunu degistiremezsin (tek admin kendini dusururdu),
      - son ADMIN dusurulemez,
      - ADMIN'i ilgilendiren gecis, birden fazla admin varken ikinci admin onayina
        duser (istek satiri); tek admin varken aninda uygulanir,
      - rol yazimi `tokenVersion`i artirir: eski rolu tasiyan token'lar aninda duser
        (gerekcesi `applyRoleChange`te).
  */
  async changeRole(targetUserId: string, newRole: Role, actor: AdminActor): Promise<ChangeRoleResult> {
    if (!actor.userId || actor.userId === targetUserId) return { ok: false, error: "cannot_change_self" };

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });
    if (!target) return { ok: false, error: "not_found" };
    if (target.role === newRole) return { ok: false, error: "same_role" };

    if (target.role !== Role.ADMIN && newRole !== Role.ADMIN) {
      await this.applyRoleChange(targetUserId, newRole, actor);
      return { ok: true, status: "applied" };
    }

    const admins = await prisma.user.count({ where: { role: Role.ADMIN } });
    // Admin rolunden cikarma: sistemde en az 2 admin olmali.
    if (target.role === Role.ADMIN && newRole !== Role.ADMIN && admins <= 1) {
      return { ok: false, error: "cannot_demote_sole_admin" };
    }

    if (admins === 1) {
      await this.applyRoleChange(targetUserId, newRole, actor, { instantReason: "sole_admin" });
      return { ok: true, status: "applied" };
    }

    try {
      await prisma.adminRoleChangeRequest.create({
        data: {
          targetUserId,
          previousRole: target.role,
          requestedRole: newRole,
          requestedByUserId: actor.userId,
        },
      });
    } catch (e) {
      if (isPrismaUniqueViolation(e)) return { ok: false, error: "pending_exists" };
      throw e;
    }

    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.role_change_request",
      entityType: "User",
      entityId: targetUserId,
      metadata: { previousRole: target.role, requestedRole: newRole },
      ip: actor.ip,
    });
    return { ok: true, status: "pending_approval" };
  }

  /*
    ROL DEGISIKLIGI TOKEN'LARI IPTAL EDER (2026-08-31'de eklendi).

    Rol hem mobil JWT'nin (`role` istemi) hem web oturum token'inin ICINDE
    tasiniyor; yetkisi ALINAN bir yonetici, token'lari dolana kadar (refresh 30
    gun) yonetici kaliyordu. `tokenVersion` artisi ikisini birden dusurur.
  */
  private async applyRoleChange(
    targetUserId: string,
    newRole: Role,
    actor: AdminActor,
    metadataExtra: Record<string, string> = {},
  ) {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole, tokenVersion: { increment: 1 } },
    });
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.role_update",
      entityType: "User",
      entityId: targetUserId,
      metadata: { newRole, ...metadataExtra },
      ip: actor.ip,
    });
  }

  /*
    Sifre sifirlama bagi + kodu, kullanicinin KENDI e-postasina gider: normal
    "sifremi unuttum" govdesi (`requestPasswordReset`). Yonetici sifreyi gormez,
    bag yaniti donmez. E-postasiz (yalniz telefonlu) hesapta `no_email`: o yol
    yoneticinin sifre belirlemesidir.
  */
  async sendPasswordReset(userId: string, actor: AdminActor, locale: string): Promise<AdminMailResult> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return { ok: false, error: "not_found" };
    const email = usableEmail(user.email);
    if (!email) return { ok: false, error: "no_email" };

    await requestPasswordReset(email, locale);
    // "requested": gonderim `requestPasswordReset` icinde atesle-unut, kayit ondan once yazilir.
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "admin.user.password_reset_requested",
      entityType: "User",
      entityId: userId,
      ip: actor.ip,
    });
    return { ok: true };
  }

  /*
    Dogrulama e-postasini yeniden gonder -- web action'i (e-postayla) ve mobil uc
    (kullanici id'siyle, `resendVerificationForUser`) bu govdeyi cagirir.
    Dogrulanmis hesaba yeni token uretilmez.
  */
  async resendVerificationEmail(rawEmail: string, actor: AdminActor, locale: string): Promise<AdminMailResult> {
    // BUG-08: e-posta bicimi dogrulanmadan token uretilebiliyordu.
    const parsed = z.string().trim().email().max(320).safeParse(rawEmail);
    if (!parsed.success) return { ok: false, error: "invalid_email" };
    const email = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
    if (!user) return { ok: false, error: "not_found" };
    if (user.emailVerified) return { ok: false, error: "already_verified" };

    const verificationToken = await generateVerificationToken(email);
    await sendVerificationEmail(email, verificationToken.token, locale);
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.verification_resent",
      entityType: "User",
      entityId: user.id,
      ip: actor.ip,
    });
    return { ok: true };
  }

  async resendVerificationForUser(userId: string, actor: AdminActor, locale: string): Promise<AdminMailResult> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return { ok: false, error: "not_found" };
    const email = usableEmail(user.email);
    if (!email) return { ok: false, error: "no_email" };
    return this.resendVerificationEmail(email, actor, locale);
  }
}

export const adminUserService = new AdminUserService();
