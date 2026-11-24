import prisma from "@/lib/db";
import { PASSWORD_RESET_IDENTIFIER_PREFIX } from "@/lib/password-reset-token";
import { BookingStatus, Prisma, Role } from "@prisma/client";
import { getPaymentProvider } from "@/lib/payments";
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
      reason: "not_found" | "not_pending" | "cannot_delete_self" | "active_bookings" | "pending_payouts" | "last_admin";
    };

export type CancelDeletionResult = { ok: true } | { ok: false; reason: "not_found" | "not_pending" | "invalid_reason" };

type Db = Prisma.TransactionClient | typeof prisma;
export type DeactivatedShop = { id: string; updatedAt: string };

function parseDeactivated(raw: Prisma.JsonValue): DeactivatedShop[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) =>
    x && typeof x === "object" && !Array.isArray(x) && typeof x.id === "string" && typeof x.updatedAt === "string"
      ? [{ id: x.id, updatedAt: x.updatedAt }]
      : [],
  );
}

class AlreadyPending extends Error {}
class CompletionAbort extends Error {
  constructor(readonly reason: "not_pending" | "active_bookings" | "pending_payouts" | "last_admin") {
    super(reason);
  }
}

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
   * Bekleyen talep varken ikinci istek hicbir seyi ezmez, yeniden bildirim gondermez.
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

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user || isAnonymizedEmail(user.email)) return { ok: false, reason: "not_found" };

    const pending = await this.pendingView(userId);
    if (pending) return pending;
    if (role === Role.ADMIN && (await this.otherActiveAdminCount(prisma, userId)) === 0) {
      return { ok: false, reason: "last_admin" };
    }

    const now = new Date();
    const dueAt = new Date(now.getTime() + ACCOUNT_DELETION_SLA_DAYS * 24 * 60 * 60 * 1000);
    const note = params.note?.trim().slice(0, DELETION_NOTE_MAX) || null;
    const locale = params.locale?.trim().slice(0, 8) || null;

    let deactivated: DeactivatedShop[];
    try {
      deactivated = await prisma.$transaction(async (tx) => {
        const base = { role, status: "PENDING" as const, contactEmail: user.email, contactLocale: locale, note, requestedAt: now, dueAt, resolvedAt: null, resolvedById: null };
        /*
          Talep once SAHIPLENIR: yeni satir ya da bitmis bir satirin kosullu yeniden
          acilmasi. Esanli ikinci istek ya benzersiz anahtarda (P2002) ya da kosulda
          (count 0) duser; dukkan listesi ve bildirim yalnizca bir kez olur.
        */
        const reopened = await tx.accountDeletionRequest.updateMany({
          where: { userId, status: { not: "PENDING" } },
          data: { ...base, deactivatedShops: [] },
        });
        if (reopened.count === 0) {
          const exists = await tx.accountDeletionRequest.findUnique({ where: { userId }, select: { id: true } });
          if (exists) throw new AlreadyPending();
          await tx.accountDeletionRequest.create({ data: { userId, ...base, deactivatedShops: [] } });
        }
        const shops = await tx.shop.findMany({ where: { ownerId: userId, isActive: true }, select: { id: true } });
        if (shops.length === 0) return [];
        await tx.shop.updateMany({ where: { id: { in: shops.map((s) => s.id) } }, data: { isActive: false } });
        // Iptalde "bu talepten beri degismedi mi" sorusu icin her dukkanin yeni damgasi.
        const stamped = await tx.shop.findMany({
          where: { id: { in: shops.map((s) => s.id) } },
          select: { id: true, updatedAt: true },
        });
        const marks = stamped.map((s) => ({ id: s.id, updatedAt: s.updatedAt.toISOString() }));
        await tx.accountDeletionRequest.update({ where: { userId }, data: { deactivatedShops: marks } });
        return marks;
      });
    } catch (e) {
      if (e instanceof AlreadyPending || (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
        const again = await this.pendingView(userId);
        if (again) return again;
      }
      throw e;
    }

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

  private async pendingView(userId: string): Promise<RequestDeletionResult | null> {
    const r = await prisma.accountDeletionRequest.findUnique({ where: { userId }, select: { status: true, dueAt: true } });
    return r?.status === "PENDING"
      ? { ok: true, alreadyPending: true, dueAt: r.dueAt, slaDays: ACCOUNT_DELETION_SLA_DAYS }
      : null;
  }

  async getDeletionRequest(userId: string): Promise<DeletionRequestView | null> {
    return prisma.accountDeletionRequest.findUnique({
      where: { userId },
      select: { status: true, requestedAt: true, dueAt: true },
    });
  }

  /**
   * Yonetici kuyrugu: bekleyenler once, her satirda tamamlamayi engelleyen durum ve
   * iptalde yeniden acilacak dukkanlar (iptal onayinda gosterilir).
   */
  async listDeletionRequests() {
    const rows = await prisma.accountDeletionRequest.findMany({
      orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
      take: 100,
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    const now = new Date();
    return Promise.all(
      rows.map(async (r) => {
        const pending = r.status === "PENDING";
        return {
          ...r,
          blockers: pending ? await this.completionBlockers(prisma, r.userId, now) : { activeBookings: 0, pendingPayouts: 0 },
          reopenShops: pending ? await this.reopenableShops(prisma, r.userId, parseDeactivated(r.deactivatedShops)) : [],
        };
      }),
    );
  }

  /**
   * Yonetici tamamlar. Talep, dukkanlarin kapatilmasi, engel kontrolu ve silme TEK
   * islemde: talep satiri kosulla sahiplenilir (esanli iptal ya da ikinci tamamlama
   * 0 satir gorup duser), engeller o kilit altinda yeniden sayilir. Islem geri
   * alinirsa hicbir sey degismez; denetim kaydi ve e-posta yalnizca basarida.
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
    // Kapanacak suresi dolmus misafir kayitlari ve Apple token'lari islemden ONCE okunur.
    await closeExpiredBookingsForGuest(req.userId, now);
    const appleTokens = await appleTokenService.collectForUser(req.userId);

    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.accountDeletionRequest.updateMany({
          where: { id: req.id, status: "PENDING" },
          data: { status: "COMPLETED", resolvedAt: now, resolvedById: params.actor.userId, contactEmail: null },
        });
        if (claimed.count === 0) throw new CompletionAbort("not_pending");
        // Yonetici arada dukkani yeniden actiysa da yeni rezervasyon alamaz; sayim bundan sonra.
        await tx.shop.updateMany({ where: { ownerId: req.userId, isActive: true }, data: { isActive: false } });
        const blockers = await this.completionBlockers(tx, req.userId, now);
        if (blockers.activeBookings > 0) throw new CompletionAbort("active_bookings");
        if (blockers.pendingPayouts > 0) throw new CompletionAbort("pending_payouts");
        if (req.role === Role.ADMIN && (await this.otherActiveAdminCount(tx, req.userId)) === 0) {
          throw new CompletionAbort("last_admin");
        }
        await this.eraseWithinTx(tx, req.userId);
      });
    } catch (e) {
      if (e instanceof CompletionAbort) return { ok: false, reason: e.reason };
      throw e;
    }

    await appleTokenService.revokeTokens(req.userId, appleTokens);
    writeAuditLog({
      actorUserId: params.actor.userId,
      actorRole: "ADMIN",
      action: "account.deletion_completed",
      entityType: "User",
      entityId: req.userId,
      metadata: { requestId: req.id, role: req.role },
      ip: params.actor.ip,
    });
    if (req.contactEmail) {
      void notificationService
        .sendAccountDeletionCompleted(req.contactEmail, req.contactLocale ?? "tr")
        .catch((err) => logger.error({ err, requestId: req.id }, "account_deletion_completed_email_failed"));
    }
    return { ok: true };
  }

  /**
   * Yonetici talebi iptal eder (ornegin kullanici vazgecti). Yalnizca BU talebin
   * kapattigi ve o andan beri degismemis dukkanlar acilir: yonetici bekleme
   * suresinde bir dukkani kendisi kapattiysa iptal onu geri acmaz.
   */
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

    const reopened = await prisma.$transaction(async (tx) => {
      const { count } = await tx.accountDeletionRequest.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: { status: "CANCELLED", resolvedAt: new Date(), resolvedById: params.actor.userId },
      });
      if (count === 0) return null;
      const shops = await this.reopenableShops(tx, req.userId, parseDeactivated(req.deactivatedShops));
      if (shops.length > 0) {
        await tx.shop.updateMany({ where: { id: { in: shops.map((s) => s.id) } }, data: { isActive: true } });
      }
      return shops.map((s) => s.id);
    });
    if (!reopened) return { ok: false, reason: "not_pending" };

    writeAuditLog({
      actorUserId: params.actor.userId,
      actorRole: "ADMIN",
      action: "account.deletion_cancelled",
      entityType: "User",
      entityId: req.userId,
      metadata: { requestId: req.id, reason, reopenedShops: reopened },
      ip: params.actor.ip,
    });
    return { ok: true };
  }

  /** Talebin kapattigi, hala kapali ve o damgadan beri degismemis dukkanlar. */
  private async reopenableShops(db: Db, ownerId: string, marks: DeactivatedShop[]) {
    if (marks.length === 0) return [];
    const shops = await db.shop.findMany({
      where: { id: { in: marks.map((m) => m.id) }, ownerId, isActive: false },
      select: { id: true, name: true, updatedAt: true },
    });
    const stamp = new Map(marks.map((m) => [m.id, m.updatedAt]));
    return shops.filter((s) => stamp.get(s.id) === s.updatedAt.toISOString()).map((s) => ({ id: s.id, name: s.name }));
  }

  private async otherActiveAdminCount(db: Db, userId: string): Promise<number> {
    return db.user.count({
      where: {
        role: Role.ADMIN,
        isBanned: false,
        id: { not: userId },
        NOT: { email: { endsWith: ANONYMIZED_EMAIL_DOMAIN } },
        OR: [{ accountDeletionRequest: null }, { accountDeletionRequest: { status: { not: "PENDING" } } }],
      },
    });
  }

  /*
    Bekleyen hakedis yalnizca para platformdan geciyorsa engeldir. Elle tahsilatta
    (`capturesOnline: false`) para zaten esnafta; PaymentSplit PENDING hic SETTLED
    olmuyor ve sayilsaydi hicbir esnaf silinemezdi.
  */
  private async completionBlockers(db: Db, userId: string, now: Date) {
    const capturesOnline = getPaymentProvider().capabilities.capturesOnline;
    const [asGuest, atShops, pendingPayouts] = await Promise.all([
      db.booking.count({
        where: {
          guestId: userId,
          status: { in: ACTIVE_BOOKING_STATUSES },
          NOT: { status: { in: [...NOT_DROPPED_STATUSES] }, checkOutTime: { lt: now } },
        },
      }),
      db.booking.count({
        where: {
          shop: { ownerId: userId },
          status: { in: ACTIVE_BOOKING_STATUSES },
          NOT: { status: { in: [...NOT_DROPPED_STATUSES] }, checkOutTime: { lt: now } },
        },
      }),
      capturesOnline
        ? db.paymentSplit.count({ where: { shop: { ownerId: userId }, status: "PENDING" } })
        : Promise.resolve(0),
    ]);
    return { activeBookings: atShops + asGuest, pendingPayouts };
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

  /** Misafir silmesi: suresi dolmuslari kapat, sil, Apple yetkisini islem basarili olunca iptal et. */
  private async erase(userId: string, now: Date): Promise<void> {
    await closeExpiredBookingsForGuest(userId, now);
    const appleTokens = await appleTokenService.collectForUser(userId);
    await prisma.$transaction((tx) => this.eraseWithinTx(tx, userId));
    await appleTokenService.revokeTokens(userId, appleTokens);
  }

  /** Silme govdesi -- kendi silmesi, yonetici silmesi ve talep tamamlama AYNI listeyi kullanir. */
  private async eraseWithinTx(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const anonEmail = `gdpr_${userId.replace(/-/g, "").slice(0, 20)}${ANONYMIZED_EMAIL_DOMAIN}`;
    // E-postaya bagli (userId'siz) satirlar: sifirlama kodu, sifirlama/dogrulama token'lari.
    const current = await tx.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, role: true } });
    const email = current?.email?.trim().toLowerCase();
    // Kodla giris satiri telefon kimligiyle de acilir (SMS acilirsa).
    const phoneIdentity = current?.phone ? normalizeTrGsm10(current.phone) : null;
    if (phoneIdentity) await tx.mobileLoginCode.deleteMany({ where: { identity: phoneIdentity } });

    if (email) {
      await tx.passwordResetCode.deleteMany({ where: { email } });
      await tx.mobileLoginCode.deleteMany({ where: { identity: email } });
      await tx.verificationToken.deleteMany({
        where: { identifier: { in: [email, `${PASSWORD_RESET_IDENTIFIER_PREFIX}${email}`] } },
      });
    }
    // Bu kullanicinin acik bildirimleri kuyruk sayacindan duser, sonra satirlar silinir.
    const openReports = await tx.reviewReport.findMany({ where: { userId, resolvedAt: null }, select: { reviewId: true } });
    if (openReports.length > 0) {
      await tx.review.updateMany({
        where: { id: { in: openReports.map((r) => r.reviewId) }, openReportCount: { gt: 0 } },
        data: { openReportCount: { decrement: 1 } },
      });
    }
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.review.deleteMany({ where: { guestId: userId } });
    await tx.reviewReport.deleteMany({ where: { userId } });
    await tx.reviewBlock.deleteMany({ where: { OR: [{ userId }, { blockedUserId: userId }] } });
    await tx.legalAcceptance.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    // Mobil cihaz token'i anonimlestirmeden sag cikan tek tanimlayici olurdu (2026-09-01).
    await tx.mobilePushToken.deleteMany({ where: { userId } });
    await tx.mobileInstall.deleteMany({ where: { userId } });
    // Personel uyeligi ve bu e-postaya giden davetler: silinen hesap hicbir dukkanda calismaz.
    await tx.shopMember.deleteMany({ where: { userId } });
    if (email) await tx.shopInvite.deleteMany({ where: { email } });
    /*
      Esnafin odeme/vergi kimligi (TCKN/VKN, IBAN, unvan, adres, iletisim). Elle
      tahsilatta platform esnafa fatura kesmez ve hakedis odemez; bu alanlari
      saklamayi gerektiren bir defter yok. Dukkan ve rezervasyon kayitlari kalir.
    */
    await tx.merchantProfile.deleteMany({ where: { shop: { ownerId: userId } } });
    /*
      Satir SILINMIYOR, alanlari bosaltiliyor: rezervasyon gecmisi ve esnafin
      hakedis defteri bu id'ye bagli, `onDelete: Cascade` ATESLENMEZ.
      `tokenVersion` artisi acik web/mobil oturumlarini dusurur (JWT, 2026-09-10).
      Yonetici misafire indirilir: anonim satir yetki tasimamali.
    */
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        phone: null,
        name: null,
        image: null,
        passwordHash: null,
        tokenVersion: { increment: 1 },
        ...(current?.role === Role.ADMIN ? { role: Role.GUEST } : {}),
      },
    });
  }
}

export const accountPrivacyService = new AccountPrivacyService();
