import prisma from "@/lib/db";
import { PASSWORD_RESET_IDENTIFIER_PREFIX } from "@/lib/password-reset-token";
import { BookingStatus, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";
import { ANONYMIZED_EMAIL_DOMAIN, isAnonymizedEmail } from "@/lib/anonymized-account";
import { NOT_DROPPED_STATUSES } from "@/lib/booking-closure";
import { closeExpiredBookingsForGuest } from "@/services/booking/closure";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { appleTokenService } from "@/services/AppleTokenService";
import { notificationService } from "@/services/NotificationService";
import logger from "@/lib/logger";

/**
 * Hesap anonimleştirme (KVKK silme hakkı) — iki taşıyıcının ORTAK gövdesi.
 *
 * NEDEN SERVİSE TAŞINDI (2026-09-01'de ölçüldü): aynı gövde web action'ında ve
 * mobil uçta ayrı ayrı yazılmıştı — rol kapısı, aktif rezervasyon kontrolü,
 * anonim e-posta üretimi, altı silme işlemi, `user.update` ve denetim kaydı.
 * `ACTIVE_BOOKING_STATUSES` listesi bile iki yerde tanımlıydı.
 *
 * Kopyalar bu sefer BİRBİRİYLE TUTARLIYDI ama İKİSİ DE `MobilePushToken`ı
 * atlıyordu: modelde `onDelete: Cascade` var ama hesap SİLİNMİYOR,
 * ANONİMLEŞTİRİLİYOR — yani cascade hiç ateşlenmiyor ve cihaz token'ları
 * anonimleştirilmiş kullanıcıya bağlı kalıyordu. Cihaz token'ı, anonimleştirmeden
 * sağ çıkan TEK tanımlayıcıdır: hesabı gerçek bir cihaza yeniden bağlayabilir.
 *
 * Yani kusur "bir kopya geride kaldı" değil, "yeni bir kişisel veri tablosu
 * eklemek kimseyi silme yolunu güncellemeye ZORLAMIYOR"du. Tek gövde bunu yarıya
 * indirir; kalan yarısını `src/__tests__/account-erasure-coverage.test.ts`
 * mandalı kapatır.
 */

/** Anonimleştirmeyi engelleyen rezervasyon durumları. */
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.WAITING_APPROVAL,
  BookingStatus.APPROVED,
  BookingStatus.PENDING,
  BookingStatus.PAID,
  BookingStatus.CHECKED_IN,
];

export type AnonymizeResult =
  | { ok: true }
  | { ok: false; reason: "not_guest" | "active_bookings" };

export type AdminAnonymizeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_found"
        | "cannot_delete_self"
        | "already_anonymized"
        | "invalid_reason"
        | "confirm_mismatch"
        | "not_guest"
        | "active_bookings";
    };

/** Esnaf/yonetici silme talebinin taahhut edilen suresi (kullaniciya gosterilen gun sayisi). */
export const ACCOUNT_DELETION_SLA_DAYS = 30;
export const DELETION_NOTE_MAX = 500;

export type DeletionRequestView = {
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  requestedAt: Date;
  dueAt: Date;
};

export type RequestDeletionResult =
  | { ok: true; alreadyPending: boolean; dueAt: Date; slaDays: number }
  | { ok: false; reason: "guest_use_delete" | "last_admin" | "not_found" };

export type CompleteDeletionResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_found" | "not_pending" | "cannot_delete_self" | "active_bookings" | "pending_payouts";
    };

export type CancelDeletionResult = { ok: true } | { ok: false; reason: "not_found" | "not_pending" | "invalid_reason" };

/** Yoneticinin silme gerekcesi: denetim kaydina girer, bos ya da anlamsiz olamaz. */
export const ADMIN_ERASURE_REASON_MIN = 5;
export const ADMIN_ERASURE_REASON_MAX = 500;

/**
 * Yazilan onay metni hesabin e-postasi ya da telefonu mu? E-posta buyuk/kucuk harf
 * duyarsiz; telefon `0`/`+90`/bosluk farklarini yok sayar (saklanan bicim 10 hane).
 */
export function erasureConfirmMatches(
  typed: string,
  account: { email: string | null; phone: string | null },
): boolean {
  const v = typed.trim();
  if (!v) return false;
  if (account.email && v.toLowerCase() === account.email.trim().toLowerCase()) return true;
  const phone = normalizeTrGsm10(v);
  return !!phone && !!account.phone && phone === normalizeTrGsm10(account.phone);
}

class AccountPrivacyService {
  /**
   * Kullanıcının kendi hesabını anonimleştirmesi.
   *
   * ROL KAPISI DEĞİL, ALAN KURALI: hesabı yalnızca MİSAFİR kapatabilir.
   * Esnaf/admin hesabının silinmesi dükkanı ve denetim izini etkiler; o yol
   * yönetim panelindedir.
   */
  async anonymizeSelf(params: {
    userId: string;
    role: Role;
    ip: string | null;
    /**
     * Denetim kaydinin eylem adi. Tasiyiciya gore ayrisir
     * (`account.anonymize_self` / `..._mobile`) -- hangi yuzeyden silindigi
     * mesru bir denetim bilgisidir, bu yuzden korunuyor.
     */
    auditAction?: string;
  }): Promise<AnonymizeResult> {
    const { userId, role, ip, auditAction = "account.anonymize_self" } = params;

    if (role !== Role.GUEST) return { ok: false, reason: "not_guest" };

    const now = new Date();
    if (await this.hasBlockingBookings(userId, now)) return { ok: false, reason: "active_bookings" };
    await this.erase(userId, now);

    writeAuditLog({
      actorUserId: userId,
      actorRole: "GUEST",
      action: auditAction,
      entityType: "User",
      entityId: userId,
      ip,
    });

    return { ok: true };
  }

  /**
   * Yonetici silmesi (mobil admin). Kendi silmesiyle AYNI kurallar ve AYNI
   * silme listesi: yalnizca MISAFIR hesabi, aktif rezervasyon varken olmaz,
   * suresi dolmus kayitlar kapanir. Ek olarak:
   *   - yonetici kendini silemez,
   *   - onay metni hesabin e-postasi/telefonu olmali (yanlis hesabi silmeye
   *     karsi; istemcideki kontrol tek basina yetmez),
   *   - gerekce zorunlu ve denetim kaydina yazilir.
   */
  async anonymizeByAdmin(params: {
    targetUserId: string;
    actor: { userId: string; ip: string | null };
    confirm: string;
    reason: string;
  }): Promise<AdminAnonymizeResult> {
    const { targetUserId, actor } = params;
    if (actor.userId === targetUserId) return { ok: false, reason: "cannot_delete_self" };

    const reason = params.reason.trim();
    if (reason.length < ADMIN_ERASURE_REASON_MIN || reason.length > ADMIN_ERASURE_REASON_MAX) {
      return { ok: false, reason: "invalid_reason" };
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, email: true, phone: true },
    });
    if (!target) return { ok: false, reason: "not_found" };
    if (isAnonymizedEmail(target.email)) {
      return { ok: false, reason: "already_anonymized" };
    }
    if (!erasureConfirmMatches(params.confirm, target)) return { ok: false, reason: "confirm_mismatch" };
    if (target.role !== Role.GUEST) return { ok: false, reason: "not_guest" };

    const now = new Date();
    if (await this.hasBlockingBookings(targetUserId, now)) return { ok: false, reason: "active_bookings" };
    await this.erase(targetUserId, now);

    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "account.anonymize_by_admin",
      entityType: "User",
      entityId: targetUserId,
      metadata: { reason },
      ip: actor.ip,
    });
    return { ok: true };
  }


  /**
   * Esnaf/yonetici hesap silme TALEBI (App Store 5.1.1(v)). Misafir aninda
   * kapatir (`anonymizeSelf`); esnafin dukkani ve hakedisi, yoneticinin de
   * yetkisi oldugu icin bunlar talep birakir ve yonetici tamamlar.
   *
   * Talep aninda esnafin acik dukkanlari yeni rezervasyona kapanir (pasif).
   * Giris acik kalir: esnaf elindeki rezervasyonlari teslim edebilmeli.
   */
  async requestDeletion(params: {
    userId: string;
    role: Role;
    ip: string | null;
    note?: string | null;
    locale?: string | null;
    auditAction?: string;
  }): Promise<RequestDeletionResult> {
    const { userId, role, ip } = params;
    if (role === Role.GUEST) return { ok: false, reason: "guest_use_delete" };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, accountDeletionRequest: { select: { status: true, dueAt: true } } },
    });
    if (!user || isAnonymizedEmail(user.email)) return { ok: false, reason: "not_found" };

    const existing = user.accountDeletionRequest;
    if (existing?.status === "PENDING") {
      return { ok: true, alreadyPending: true, dueAt: existing.dueAt, slaDays: ACCOUNT_DELETION_SLA_DAYS };
    }
    if (role === Role.ADMIN && (await this.otherActiveAdminCount(userId)) === 0) {
      return { ok: false, reason: "last_admin" };
    }

    const now = new Date();
    const dueAt = new Date(now.getTime() + ACCOUNT_DELETION_SLA_DAYS * 24 * 60 * 60 * 1000);
    const note = params.note?.trim().slice(0, DELETION_NOTE_MAX) || null;
    const locale = params.locale?.trim().slice(0, 8) || null;

    const deactivated = await prisma.$transaction(async (tx) => {
      const shops = await tx.shop.findMany({ where: { ownerId: userId, isActive: true }, select: { id: true } });
      const ids = shops.map((s) => s.id);
      if (ids.length > 0) await tx.shop.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      const data = {
        role,
        status: "PENDING" as const,
        contactEmail: user.email,
        contactLocale: locale,
        note,
        deactivatedShopIds: ids,
        requestedAt: now,
        dueAt,
        resolvedAt: null,
        resolvedById: null,
      };
      await tx.accountDeletionRequest.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      return ids;
    });

    writeAuditLog({
      actorUserId: userId,
      actorRole: role,
      action: params.auditAction ?? "account.deletion_requested",
      entityType: "User",
      entityId: userId,
      metadata: { deactivatedShops: deactivated.length },
      ip,
    });
    void notificationService
      .notifyAdminsForDeletionRequest({ name: user.name, role, dueAt })
      .catch((err) => logger.error({ err, userId }, "notify_admins_deletion_request_failed"));

    return { ok: true, alreadyPending: false, dueAt, slaDays: ACCOUNT_DELETION_SLA_DAYS };
  }

  async getDeletionRequest(userId: string): Promise<DeletionRequestView | null> {
    return prisma.accountDeletionRequest.findUnique({
      where: { userId },
      select: { status: true, requestedAt: true, dueAt: true },
    });
  }

  /** Yonetici kuyrugu: bekleyenler once, her satirda tamamlamayi engelleyen durum. */
  async listDeletionRequests() {
    const rows = await prisma.accountDeletionRequest.findMany({
      orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
      take: 100,
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    const now = new Date();
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        blockers: r.status === "PENDING" ? await this.completionBlockers(r.userId, now) : { activeBookings: 0, pendingPayouts: 0 },
      })),
    );
  }

  /**
   * Yonetici tamamlar: AYNI anonimlestirme govdesi (`erase`). Misafir olarak ya
   * da dukkaninda aktif rezervasyon, ya da bekleyen hakedis varken olmaz.
   */
  async completeDeletionRequest(params: {
    requestId: string;
    actor: { userId: string; ip: string | null };
  }): Promise<CompleteDeletionResult> {
    const req = await prisma.accountDeletionRequest.findUnique({ where: { id: params.requestId } });
    if (!req) return { ok: false, reason: "not_found" };
    if (req.status !== "PENDING") return { ok: false, reason: "not_pending" };
    if (req.userId === params.actor.userId) return { ok: false, reason: "cannot_delete_self" };

    const now = new Date();
    const blockers = await this.completionBlockers(req.userId, now);
    if (blockers.activeBookings > 0) return { ok: false, reason: "active_bookings" };
    if (blockers.pendingPayouts > 0) return { ok: false, reason: "pending_payouts" };

    await this.erase(req.userId, now);
    // Kosullu: iki yonetici ayni anda tamamlarsa ikinci e-posta gitmez.
    const { count } = await prisma.accountDeletionRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: { status: "COMPLETED", resolvedAt: now, resolvedById: params.actor.userId, contactEmail: null },
    });

    writeAuditLog({
      actorUserId: params.actor.userId,
      actorRole: "ADMIN",
      action: "account.deletion_completed",
      entityType: "User",
      entityId: req.userId,
      metadata: { requestId: req.id, role: req.role },
      ip: params.actor.ip,
    });
    if (count > 0 && req.contactEmail) {
      void notificationService
        .sendAccountDeletionCompleted(req.contactEmail, req.contactLocale ?? "tr")
        .catch((err) => logger.error({ err, requestId: req.id }, "account_deletion_completed_email_failed"));
    }
    return { ok: true };
  }

  /** Yonetici talebi iptal eder (ornegin kullanici vazgecti); kapatilan dukkanlar geri acilir. */
  async cancelDeletionRequest(params: {
    requestId: string;
    reason: string;
    actor: { userId: string; ip: string | null };
  }): Promise<CancelDeletionResult> {
    const reason = params.reason.trim();
    if (reason.length < ADMIN_ERASURE_REASON_MIN || reason.length > ADMIN_ERASURE_REASON_MAX) {
      return { ok: false, reason: "invalid_reason" };
    }
    const req = await prisma.accountDeletionRequest.findUnique({ where: { id: params.requestId } });
    if (!req) return { ok: false, reason: "not_found" };
    if (req.status !== "PENDING") return { ok: false, reason: "not_pending" };

    const done = await prisma.$transaction(async (tx) => {
      const { count } = await tx.accountDeletionRequest.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: { status: "CANCELLED", resolvedAt: new Date(), resolvedById: params.actor.userId },
      });
      if (count === 0) return false;
      if (req.deactivatedShopIds.length > 0) {
        await tx.shop.updateMany({
          where: { id: { in: req.deactivatedShopIds }, ownerId: req.userId },
          data: { isActive: true },
        });
      }
      return true;
    });
    if (!done) return { ok: false, reason: "not_pending" };

    writeAuditLog({
      actorUserId: params.actor.userId,
      actorRole: "ADMIN",
      action: "account.deletion_cancelled",
      entityType: "User",
      entityId: req.userId,
      metadata: { requestId: req.id, reason },
      ip: params.actor.ip,
    });
    return { ok: true };
  }

  private async otherActiveAdminCount(userId: string): Promise<number> {
    return prisma.user.count({
      where: {
        role: Role.ADMIN,
        isBanned: false,
        id: { not: userId },
        NOT: { email: { endsWith: ANONYMIZED_EMAIL_DOMAIN } },
        OR: [{ accountDeletionRequest: null }, { accountDeletionRequest: { status: { not: "PENDING" } } }],
      },
    });
  }

  private async completionBlockers(userId: string, now: Date) {
    const [asGuest, atShops, pendingPayouts] = await Promise.all([
      this.hasBlockingBookings(userId, now),
      prisma.booking.count({
        where: {
          shop: { ownerId: userId },
          status: { in: ACTIVE_BOOKING_STATUSES },
          NOT: { status: { in: [...NOT_DROPPED_STATUSES] }, checkOutTime: { lt: now } },
        },
      }),
      prisma.paymentSplit.count({ where: { shop: { ownerId: userId }, status: "PENDING" } }),
    ]);
    return { activeBookings: atShops + (asGuest ? 1 : 0), pendingPayouts };
  }

  /*
    Suresi dolmus (valizi hic birakilmamis, alma saati gecmis) kayit aktif
    SAYILMAZ: misafir gelmeyecek, ama eskiden hesabini kapatamiyordu.
    Engel yoksa silmeden once kapanirlar (`erase`).
  */
  private async hasBlockingBookings(userId: string, now: Date): Promise<boolean> {
    const activeCount = await prisma.booking.count({
      where: {
        guestId: userId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        NOT: { status: { in: [...NOT_DROPPED_STATUSES] }, checkOutTime: { lt: now } },
      },
    });
    return activeCount > 0;
  }

  /** Silme govdesi -- kendi silmesi ve yonetici silmesi AYNI listeyi kullanir. */
  private async erase(userId: string, now: Date): Promise<void> {
    await closeExpiredBookingsForGuest(userId, now);
    // Apple yetkisi hesap satirlari silinmeden ONCE iptal edilir (5.1.1(v)); hata silmeyi durdurmaz.
    await appleTokenService.revokeForUser(userId);

    const anonEmail = `gdpr_${userId.replace(/-/g, "").slice(0, 20)}${ANONYMIZED_EMAIL_DOMAIN}`;
    // E-postaya bagli (userId'siz) satirlar: sifirlama kodu, sifirlama/dogrulama token'lari.
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const email = current?.email?.trim().toLowerCase();

    await prisma.$transaction([
      ...(email
        ? [
            prisma.passwordResetCode.deleteMany({ where: { email } }),
            prisma.verificationToken.deleteMany({
              where: { identifier: { in: [email, `${PASSWORD_RESET_IDENTIFIER_PREFIX}${email}`] } },
            }),
          ]
        : []),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.review.deleteMany({ where: { guestId: userId } }),
      prisma.reviewReport.deleteMany({ where: { userId } }),
      prisma.reviewBlock.deleteMany({ where: { OR: [{ userId }, { blockedUserId: userId }] } }),
      prisma.legalAcceptance.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      /*
        MOBIL CIHAZ TOKEN'I. Bu satir 2026-09-01'e kadar IKI TASIYICIDA DA
        YOKTU -- `pushSubscription` siliniyordu, yani niyet acikti; bu tablo
        sonradan eklenmis ve silme yolu guncellenmemisti.
      */
      prisma.mobilePushToken.deleteMany({ where: { userId } }),
      prisma.mobileInstall.deleteMany({ where: { userId } }),
      /*
        Satir SILINMIYOR, alanlari bosaltiliyor: rezervasyon gecmisi ve esnafin
        hakedis defteri bu id'ye bagli. Bu yuzden `onDelete: Cascade` bagli
        tablolarda ATESLENMEZ -- silinmesi gerekenler yukarida ACIKCA yaziliyor.
      */
      prisma.user.update({
        where: { id: userId },
        data: {
          email: anonEmail,
          phone: null,
          name: null,
          image: null,
          passwordHash: null,
          /*
            TOKENVERSION ARTIRILIR (2026-09-10'da bulundu). `prisma.session`
            silme, Auth.js'in JWT-stratejili web oturumunu DUSURMEZ (bu proje
            DB session'i degil, cerezdeki JWT'yi kullaniyor) ve mobil access/
            refresh token'lari da stateless -- ikisi de gecerliligi yalniz
            `tokenVersion` karsilastirmasina bagliyor (auth.ts jwt callback'i,
            requireMobileUser). Bu satir olmadan "hesabimi sil" isleyen bir
            kullanicinin ONCEDEN acik oturumlari (web cerezi 60 saniyede bir
            yeniden dogrulanana/30 gun boyunca, mobil access token kendi
            omrunce) anonimlestirilmis satira karsi calismaya devam ediyordu --
            `toggleUserBanAction`/sifre sifirlama/`revokeAllUserSessions`
            projede kurulu ayni desen burada atlanmisti.
          */
          tokenVersion: { increment: 1 },
        },
      }),
    ]);
  }
}

export const accountPrivacyService = new AccountPrivacyService();
