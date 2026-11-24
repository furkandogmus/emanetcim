import { Prisma, Role, type BookingStatus } from "@prisma/client";
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
import { roleChangeData } from "@/lib/role-change-data";
import { retryOnWriteConflict } from "@/lib/tx-retry";
import logger from "@/lib/logger";
import { isPrismaForeignKeyViolation } from "@/lib/prisma-errors";

export type AdminActor = { userId: string | null; ip: string | null };

export type ChangeRoleResult =
  | { ok: true; status: "applied" | "pending_approval" }
  | {
      ok: false;
      error: "not_found" | "cannot_change_self" | "same_role" | "pending_exists" | "cannot_demote_sole_admin";
    };

export type ApproveRoleChangeResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "cannot_self_approve" | "stale" | "cannot_demote_sole_admin" | "unauthorized" };

export type CancelRoleChangeResult = { ok: true } | { ok: false; error: "not_found" | "unauthorized" };

export type AdminMailResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "no_email" | "invalid_email" | "already_verified" };

export type DeleteUserResult =
  | { ok: true }
  | {
      ok: false;
      error: "cannot_delete_self" | "target_is_admin" | "has_payment_history" | "has_active_booking" | "blocked_by_relations";
    };

export type BlockIpResult =
  | { ok: true; ip: string }
  | { ok: false; error: "invalid_ip" | "own_ip" | "not_found" | "no_ip" };

/** Silmeyi engelleyen acik rezervasyon durumlari. */
const DELETE_BLOCKING_STATUSES: BookingStatus[] = ["WAITING_APPROVAL", "APPROVED", "PENDING", "PAID", "CHECKED_IN"];

const ipSchema = z.string().trim().min(7).max(45).regex(/^[a-fA-F0-9:.]+$/);

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
  reviewSandbox: true,
  createdAt: true,
  _count: { select: { bookings: true, shops: true } },
} as const satisfies Prisma.UserSelect;

/** Web `/admin/users` suzgecleriyle ayni anlam; mobil liste sunucuda suzer. */
export type AdminUserFilters = {
  role?: Role | null;
  status?: "ACTIVE" | "BANNED" | "UNVERIFIED" | null;
  type?: "REAL" | "TEST" | null;
};

function userSearchWhere(q: string, filters: AdminUserFilters = {}): Prisma.UserWhereInput | undefined {
  const and: Prisma.UserWhereInput[] = [];
  const term = q.trim();
  if (term) {
    // Telefon: bosluk/tire/+90/0 onekleri ne olursa olsun saklanan bicimle eslesir.
    const digits = phoneSearchDigits(term, 4);
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }
  if (filters.role) and.push({ role: filters.role });
  if (filters.status === "BANNED") and.push({ isBanned: true });
  else if (filters.status === "UNVERIFIED") and.push({ isBanned: false, emailVerified: null });
  else if (filters.status === "ACTIVE") and.push({ isBanned: false, emailVerified: { not: null } });
  if (filters.type) and.push({ isTest: filters.type === "TEST" });
  if (and.length === 0) return undefined;
  return and.length === 1 ? and[0] : { AND: and };
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
  async searchPage(q: string, opts: { cursor?: string | null; take?: number; filters?: AdminUserFilters } = {}) {
    const take = Math.min(Math.max(1, opts.take ?? 50), 100);
    const rows = await prisma.user.findMany({
      where: userSearchWhere(q, opts.filters),
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
    INCELEME (App Review) HESABI (2026-11-23): `reviewSandbox` hesap test
    dukkanlarini gorur ve onlara rezervasyon yapabilir. `isTest`ten ayri bayrak:
    o el ile verilen etiket ve davranisi degistirmemeli. ADMIN reddedilir;
    token iptali gerekmez, bayrak her istekte veritabanindan okunur.
  */
  async setReviewSandbox(
    userId: string,
    reviewSandbox: boolean,
    actor: AdminActor,
  ): Promise<{ ok: true } | { ok: false; error: "not_found" | "cannot_flag_admin" }> {
    const exists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, reviewSandbox: true },
    });
    if (!exists) return { ok: false, error: "not_found" };
    if (reviewSandbox && exists.role === "ADMIN") return { ok: false, error: "cannot_flag_admin" };
    if (exists.reviewSandbox === reviewSandbox) return { ok: true };

    await prisma.user.update({ where: { id: userId }, data: { reviewSandbox } });
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.review_sandbox_toggle",
      entityType: "User",
      entityId: userId,
      metadata: { reviewSandbox },
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
        lastIp: true,
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

  /** Bekleyen rol degisikligi istekleri (web `/admin/role-approvals` ile ayni liste, eskiden ilk). */
  async listRoleChangeRequests() {
    return prisma.adminRoleChangeRequest.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        targetUser: { select: { id: true, name: true, email: true, role: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /*
    IKINCI ADMIN ONAYI -- govde 2026-11-23'te `approveAdminRoleChangeAction`tan tasindi;
    mobil admin ucu da buradan gecer. Istegi acan admin kendi istegini onaylayamaz.
  */
  async approveRoleChange(requestId: string, actor: AdminActor): Promise<ApproveRoleChangeResult> {
    const actorId = actor.userId;
    if (!actorId) return { ok: false, error: "unauthorized" };

    const existing = await prisma.adminRoleChangeRequest.findUnique({ where: { id: requestId } });
    if (!existing) return { ok: false, error: "not_found" };
    if (existing.requestedByUserId === actorId) return { ok: false, error: "cannot_self_approve" };

    /*
      SERIALIZABLE + YENIDEN DENEME. Iki admin varken birbirini dusuren iki onay
      ayni anda calisirsa ikisi de "2 admin var" sayip yaziyordu: sistemde admin
      kalmiyordu. Serializable bu yazma sapmasini P2034 ile reddeder; yeniden
      denemede sayim 1'dir ve ikinci onay `cannot_demote_sole_admin` doner.
    */
    const txResult = await retryOnWriteConflict(() => prisma.$transaction(async (tx) => {
      const reqRow = await tx.adminRoleChangeRequest.findUnique({ where: { id: requestId } });
      if (!reqRow) return { code: "not_found" as const };

      const user = await tx.user.findUnique({
        where: { id: reqRow.targetUserId },
        select: { id: true, role: true },
      });
      if (!user || user.role !== reqRow.previousRole) {
        await tx.adminRoleChangeRequest.delete({ where: { id: requestId } });
        return { code: "stale" as const };
      }

      if (reqRow.requestedRole !== Role.ADMIN && user.role === Role.ADMIN) {
        const adminCount = await tx.user.count({ where: { role: Role.ADMIN } });
        if (adminCount <= 1) {
          await tx.adminRoleChangeRequest.delete({ where: { id: requestId } });
          return { code: "cannot_demote_sole_admin" as const };
        }
      }

      // Rol degisikligi token'lari iptal eder -- gerekcesi `applyRoleChange`te.
      await tx.user.update({ where: { id: user.id }, data: roleChangeData(reqRow.requestedRole) });
      await tx.adminRoleChangeRequest.delete({ where: { id: requestId } });
      return { code: "ok" as const, targetId: user.id, newRole: reqRow.requestedRole };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), { label: "approveAdminRoleChange" });

    if (txResult.code !== "ok") return { ok: false, error: txResult.code };

    writeAuditLog({
      actorUserId: actorId,
      actorRole: "ADMIN",
      action: "user.role_update_approved",
      entityType: "User",
      entityId: txResult.targetId,
      metadata: {
        newRole: txResult.newRole,
        approvedRequestId: requestId,
        proposedBy: existing.requestedByUserId,
      },
      ip: actor.ip,
    });
    return { ok: true };
  }

  /** Istegi geri ceker / reddeder (web "Iptal" ile ayni): rol degismez, istek silinir. */
  async cancelRoleChange(requestId: string, actor: AdminActor): Promise<CancelRoleChangeResult> {
    if (!actor.userId) return { ok: false, error: "unauthorized" };

    const row = await prisma.adminRoleChangeRequest.findUnique({ where: { id: requestId } });
    if (!row) return { ok: false, error: "not_found" };

    // Iki admin ayni anda reddederse ikincisi `delete`te P2025 ile 500 aliyordu.
    const { count } = await prisma.adminRoleChangeRequest.deleteMany({ where: { id: requestId } });
    if (count === 0) return { ok: false, error: "not_found" };

    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.role_change_request_cancel",
      entityType: "AdminRoleChangeRequest",
      entityId: requestId,
      metadata: {
        targetUserId: row.targetUserId,
        previousRole: row.previousRole,
        requestedRole: row.requestedRole,
        originallyRequestedBy: row.requestedByUserId,
      },
      ip: actor.ip,
    });
    return { ok: true };
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
    await prisma.user.update({ where: { id: targetUserId }, data: roleChangeData(newRole) });
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

  /*
    KULLANICIYI TAMAMEN SIL -- govde 2026-11-24'te `deleteUserAction`tan tasindi;
    mobil admin ucu da bunu cagirir. Kurallar:
      - kendini silemezsin,
      - normal hesapta acik rezervasyon (misafir ya da dukkan sahibi olarak) varsa
        silinmez,
      - yasakli hesapta acik rezervasyonlar `cancelBooking` yoluyla (iade + slot
        temizligi) zorla iptal edilir; kapatilamayan kalirsa (CHECKED_IN: valiz
        rafta) silinmez -- esnaf valizi kime verecegini bilemezdi.
    Zaten yoksa basari: islem tekrarlanabilir.
  */
  async deleteUser(userId: string, actor: AdminActor & { reason?: string | null }): Promise<DeleteUserResult> {
    if (actor.userId != null && actor.userId === userId) return { ok: false, error: "cannot_delete_self" };

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true, role: true } });
    if (!target) return { ok: true };
    // Yonetici once iki admin onayli rol akisiyla dusurulur; silme onun yan kapisi olmasin.
    if (target.role === "ADMIN") return { ok: false, error: "target_is_admin" };
    /*
      Kalici silme Booking -> PaymentLog -> PaymentSplit zincirini cascade siler:
      dukkanin bekleyen hakedisi ve odeme gecmisi kaybolurdu. Odeme izi olan hesap
      silinmez; yol anonimlestirme (`AccountPrivacyService`), o kayitlari korur.
    */
    const [payments, pendingPayouts] = await Promise.all([
      prisma.paymentLog.count({ where: { booking: { OR: [{ guestId: userId }, { shop: { ownerId: userId } }] } } }),
      prisma.paymentSplit.count({ where: { shop: { ownerId: userId }, status: "PENDING" } }),
    ]);
    if (payments > 0 || pendingPayouts > 0) return { ok: false, error: "has_payment_history" };

    if (target.isBanned) {
      // Gec yukleme: iptal zinciri bildirim servisini getirir; servisin diger cagiranlari onu tasimasin.
      const { forceCancelOpenBookingsForUser } = await import("@/services/booking/partner-review");
      const summary = await forceCancelOpenBookingsForUser(userId, DELETE_BLOCKING_STATUSES);
      if (summary.failed > 0) {
        logger.warn({ userId, ...summary }, "admin_delete_user_blocked_uncancellable_booking");
        return { ok: false, error: "has_active_booking" };
      }
    } else {
      const activeBooking = await prisma.booking.findFirst({
        where: {
          status: { in: DELETE_BLOCKING_STATUSES },
          OR: [{ guestId: userId }, { shop: { ownerId: userId } }],
        },
        select: { id: true },
      });
      if (activeBooking) {
        logger.warn({ userId, bookingId: activeBooking.id }, "admin_delete_user_blocked_active_booking");
        return { ok: false, error: "has_active_booking" };
      }
    }

    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch (e) {
      if (isPrismaForeignKeyViolation(e)) {
        logger.warn({ userId, err: e }, "admin_delete_user_fk_blocked");
        return { ok: false, error: "blocked_by_relations" };
      }
      throw e;
    }

    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.delete",
      entityType: "User",
      entityId: userId,
      metadata: { targetRole: target.role, ...(actor.reason?.trim() ? { reason: actor.reason.trim() } : {}) },
      ip: actor.ip,
    });
    return { ok: true };
  }

  /*
    IP ENGELLE -- govde `blockIpAction`tan tasindi. Yoneticinin kendi IP'si
    reddedilir: ayni agdaki (ofis, CGNAT) misafiri engellerken kendini kilitlemesin.
    Tekrar engellemek gerekceyi gunceller.
  */
  async blockIp(
    rawIp: string,
    reason: string | null,
    actor: AdminActor,
    opts: { userId?: string } = {},
  ): Promise<BlockIpResult> {
    const parsed = ipSchema.safeParse(rawIp ?? "");
    if (!parsed.success) return { ok: false, error: "invalid_ip" };
    const ip = parsed.data;
    if (actor.ip && actor.ip.trim() === ip) return { ok: false, error: "own_ip" };

    const note = reason?.trim().slice(0, 500) || null;
    await prisma.blockedIp.upsert({ where: { ip }, update: { reason: note }, create: { ip, reason: note } });
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "ip.block",
      entityType: opts.userId ? "User" : "BlockedIp",
      entityId: opts.userId ?? ip,
      metadata: { ip, ...(note ? { reason: note } : {}) },
      ip: actor.ip,
    });
    return { ok: true, ip };
  }

  /** Kullanicinin son giris IP'sini engeller (mobil uc IP'yi govdede almaz, kayittan okur). */
  async blockUserIp(userId: string, reason: string | null, actor: AdminActor): Promise<BlockIpResult> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastIp: true } });
    if (!user) return { ok: false, error: "not_found" };
    if (!user.lastIp) return { ok: false, error: "no_ip" };
    return this.blockIp(user.lastIp, reason, actor, { userId });
  }
}

export const adminUserService = new AdminUserService();
