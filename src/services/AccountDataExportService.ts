import type { Role } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { isAnonymizedEmail } from "@/lib/anonymized-account";
import { sendDataExportEmail } from "@/lib/mail";

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
const FAILED_AUDIT_ACTION = "account.data_export_failed";
/** Bu sureden eski "sending" satiri cokmus bir gonderimdir: hak yanmis sayilir. */
const IN_PROGRESS_MS = 5 * 60 * 1000;

export type DataExportEmailResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" | "no_verified_email" | "mail_failed" | "in_progress" }
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

    const [bookings, reviews, legalAcceptances, shops, affiliate, deletionRequest, shopMemberships] = await Promise.all([
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
      // Personel oldugu dukkanlar (KVKK: hangi isletmenin verisine eristigi).
      prisma.shopMember.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { role: true, createdAt: true, shop: { select: { id: true, name: true } } },
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
      shopMemberships: shopMemberships.map((m) => ({
        shopId: m.shop.id,
        shopName: m.shop.name,
        role: m.role,
        since: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Dışa aktarımı hesabın doğrulanmış adresine gönderir. Sınır denetim kaydından
   * okunur (bellek içi sınır 5 dakikadan uzun pencere tutmuyor). Kayıt gönderimden
   * ÖNCE, kullanıcı başına kilit altında sahiplenilir: eşzamanlı ikinci istek
   * `in_progress` alır, kayıt yazılamazsa hiç gönderilmez. Düşen gönderimde satır
   * `..._failed` olur ve hak yanmaz; o güncelleme de düşerse satır kalır ve 24 saat
   * kilitli kalır (sınırın sessizce kaybolmasından iyidir).
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

    const claim = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`data-export-email:${user.id}`})::bigint)`;
      const last = await tx.auditLog.findFirst({
        where: {
          action: EMAIL_AUDIT_ACTION,
          entityType: "User",
          entityId: user.id,
          createdAt: { gt: new Date(now.getTime() - DATA_EXPORT_EMAIL_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, metadata: true },
      });
      if (last) return { taken: last, id: null } as const;
      const row = await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: params.role,
          action: EMAIL_AUDIT_ACTION,
          entityType: "User",
          entityId: user.id,
          metadata: { channel: params.channel, status: "sending" },
          ip: params.ip,
        },
        select: { id: true },
      });
      return { taken: null, id: row.id } as const;
    });

    if (claim.taken) {
      const { taken } = claim;
      const sending = metadataStatus(taken.metadata) === "sending";
      if (sending && now.getTime() - taken.createdAt.getTime() < IN_PROGRESS_MS) {
        return { ok: false, reason: "in_progress" };
      }
      return {
        ok: false,
        reason: "rate_limited",
        retryAt: new Date(taken.createdAt.getTime() + DATA_EXPORT_EMAIL_WINDOW_MS),
      };
    }

    let sent = false;
    try {
      const data = await this.buildExport(user.id, now);
      sent =
        !!data &&
        (await sendDataExportEmail({
          email: user.email,
          locale: params.locale ?? "tr",
          filename: `bagajpark-data-${user.id.slice(0, 8)}.json`,
          json: JSON.stringify(data, null, 2),
        }));
    } catch (err) {
      logger.error({ err, userId: user.id }, "data_export_email_build_failed");
    }

    try {
      await prisma.auditLog.update({
        where: { id: claim.id },
        data: sent
          ? { metadata: { channel: params.channel, status: "sent" } }
          : { action: FAILED_AUDIT_ACTION, metadata: { channel: params.channel, status: "failed" } },
      });
    } catch (err) {
      logger.error({ err, userId: user.id, sent }, "data_export_audit_update_failed");
    }
    return sent ? { ok: true, email: user.email } : { ok: false, reason: "mail_failed" };
  }
}

function metadataStatus(raw: unknown): string | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { status?: unknown }).status === "string"
    ? (raw as { status: string }).status
    : null;
}

export const accountDataExportService = new AccountDataExportService();
