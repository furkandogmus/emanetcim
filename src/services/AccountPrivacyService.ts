import prisma from "@/lib/db";
import { BookingStatus, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";

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

    const activeCount = await prisma.booking.count({
      where: { guestId: userId, status: { in: ACTIVE_BOOKING_STATUSES } },
    });
    if (activeCount > 0) return { ok: false, reason: "active_bookings" };

    const anonEmail = `gdpr_${userId.replace(/-/g, "").slice(0, 20)}@invalid.local`;

    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.review.deleteMany({ where: { guestId: userId } }),
      prisma.legalAcceptance.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      /*
        MOBIL CIHAZ TOKEN'I. Bu satir 2026-09-01'e kadar IKI TASIYICIDA DA
        YOKTU -- `pushSubscription` siliniyordu, yani niyet acikti; bu tablo
        sonradan eklenmis ve silme yolu guncellenmemisti.
      */
      prisma.mobilePushToken.deleteMany({ where: { userId } }),
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
        },
      }),
    ]);

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
}

export const accountPrivacyService = new AccountPrivacyService();
