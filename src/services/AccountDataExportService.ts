import type { Role } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { isAnonymizedEmail } from "@/lib/anonymized-account";
import { sendDataExportEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";

/**
 * KVKK md. 11 / GDPR md. 15 veri dışa aktarma — web indirme, web e-posta ve
 * mobil e-posta AYNI gövdeyi kullanır.
 *
 * NEDEN E-POSTA (2026-11-24): mobilde dosya/paylaşım modülü yok ve yalnız bunun
 * için native sürüm çıkarmak gerekmesin. Dosya hesabın DOĞRULANMIŞ adresine
 * gider: oturumu çalınmış biri dışa aktarmayı kendi kutusuna yönlendiremez.
 *
 * Esnafın ödeme/vergi kimliği (IBAN, TCKN/VKN) son 4 haneyle gelir: e-posta
 * uçtan uca şifreli bir kanal değil; tam değerler esnaf panelinde görünüyor.
 */

/** E-posta yolu: hesap başına 24 saatte bir. */
export const DATA_EXPORT_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_AUDIT_ACTION = "account.data_export_emailed";

export type DataExportEmailResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" | "no_verified_email" | "mail_failed" }
  | { ok: false; reason: "rate_limited"; retryAt: Date };

function maskTail(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.replace(/\s+/g, "");
  return v.length <= 4 ? "****" : `${"*".repeat(v.length - 4)}${v.slice(-4)}`;
}

class AccountDataExportService {
  /** Kullanıcıyla ilişkili kişisel veri. Bulunamazsa `null`. */
  async buildExport(userId: string, now = new Date()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        emailVerified: true,
        phone: true,
        name: true,
        image: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
        accounts: { select: { provider: true } },
      },
    });
    if (!user) return null;

    const [bookings, reviews, legalAcceptances, shops, affiliate, deletionRequest] = await Promise.all([
      prisma.booking.findMany({
        where: { guestId: userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          shopId: true,
          checkInTime: true,
          checkOutTime: true,
          bagCountS: true,
          bagCountM: true,
          bagCountXl: true,
          totalPrice: true,
          createdAt: true,
        },
      }),
      prisma.review.findMany({
        where: { guestId: userId },
        select: { id: true, bookingId: true, rating: true, comment: true, createdAt: true },
      }),
      prisma.legalAcceptance.findMany({
        where: { userId },
        select: { documentKey: true, version: true, acceptedAt: true },
      }),
      prisma.shop.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          district: true,
          isActive: true,
          createdAt: true,
          merchantProfile: {
            select: {
              legalType: true,
              legalName: true,
              tckn: true,
              vkn: true,
              taxOffice: true,
              iban: true,
              ibanHolder: true,
              addressLine: true,
              city: true,
              district: true,
              phone: true,
              email: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.affiliate.findUnique({
        where: { userId },
        select: {
          code: true,
          displayName: true,
          type: true,
          status: true,
          contactEmail: true,
          contactPhone: true,
          applicationNote: true,
          commissionRate: true,
          guestDiscountRate: true,
          createdAt: true,
        },
      }),
      prisma.accountDeletionRequest.findUnique({
        where: { userId },
        select: { status: true, requestedAt: true, dueAt: true, note: true },
      }),
    ]);

    const { accounts, ...profile } = user;
    return {
      exportedAt: now.toISOString(),
      user: { ...profile, signInProviders: [...new Set(accounts.map((a) => a.provider))] },
      bookings,
      reviews,
      legalAcceptances,
      shops: shops.map(({ merchantProfile: mp, ...shop }) => ({
        ...shop,
        payoutProfile: mp
          ? { ...mp, tckn: maskTail(mp.tckn), vkn: maskTail(mp.vkn), iban: maskTail(mp.iban) }
          : null,
      })),
      affiliate,
      deletionRequest,
    };
  }

  /**
   * Dışa aktarımı hesabın doğrulanmış adresine gönderir. Sınır denetim kaydından
   * okunur (bellek içi sınır 5 dakikadan uzun pencere tutmuyor); kayıt yalnız
   * gönderim başarılıysa yazılır, yani düşen gönderim hakkı yakmaz.
   */
  async emailExport(params: {
    userId: string;
    role: Role;
    locale?: string | null;
    ip: string | null;
    channel: "web" | "mobile";
    now?: Date;
  }): Promise<DataExportEmailResult> {
    const now = params.now ?? new Date();
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) return { ok: false, reason: "not_found" };
    if (!user.email || !user.emailVerified || isAnonymizedEmail(user.email)) {
      return { ok: false, reason: "no_verified_email" };
    }

    const last = await prisma.auditLog.findFirst({
      where: {
        action: EMAIL_AUDIT_ACTION,
        entityType: "User",
        entityId: user.id,
        createdAt: { gt: new Date(now.getTime() - DATA_EXPORT_EMAIL_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last) {
      return { ok: false, reason: "rate_limited", retryAt: new Date(last.createdAt.getTime() + DATA_EXPORT_EMAIL_WINDOW_MS) };
    }
    // Eşzamanlı çift dokunuşa karşı kısa kilit: kayıt gönderimden sonra yazıldığı için.
    if (!(await rateLimit(`data-export-email:${user.id}`, 1, 60_000))) {
      return { ok: false, reason: "rate_limited", retryAt: new Date(now.getTime() + 60_000) };
    }

    const data = await this.buildExport(user.id, now);
    if (!data) return { ok: false, reason: "not_found" };
    const sent = await sendDataExportEmail({
      email: user.email,
      locale: params.locale ?? "tr",
      filename: `bagajpark-data-${user.id.slice(0, 8)}.json`,
      json: JSON.stringify(data, null, 2),
    });
    if (!sent) return { ok: false, reason: "mail_failed" };

    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: params.role,
          action: EMAIL_AUDIT_ACTION,
          entityType: "User",
          entityId: user.id,
          metadata: { channel: params.channel },
          ip: params.ip,
        },
      });
    } catch (err) {
      logger.error({ err, userId: user.id }, "data_export_audit_failed");
    }
    return { ok: true, email: user.email };
  }
}

export const accountDataExportService = new AccountDataExportService();
