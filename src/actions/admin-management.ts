"use server";

import prisma from "@/lib/db";
import { shopService } from "@/services/ShopService";
import { BookingStatus, Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import logger from "@/lib/logger";
import { bookingService } from "@/services/BookingService";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { writeAuditLog } from "@/lib/audit-log";
import {
  isPrismaForeignKeyViolation,
  isPrismaUniqueViolation,
} from "@/lib/prisma-errors";
import {
  DELETE_USER_BLOCKED_CODE,
  DELETE_USER_HAS_ACTIVE_BOOKING_CODE,
} from "@/lib/admin/constants";
import { assertAdmin } from "@/lib/action-auth";

/**
 * Admin koruması sağlayan yardımcı fonksiyon
 */
/**
 * Yetki kapisi `src/lib/action-auth.ts`'te; burasi yalnizca eski cagri bicimini
 * korur (`session.user.id` bekleyen 14 cagri yeri var).
 */
async function ensureAdmin() {
  const actor = await assertAdmin();
  return { user: actor };
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

/**
 * Kullanıcıyı banla veya banını kaldır
 */
export async function toggleUserBanAction(userId: string, isBanned: boolean) {
  const session = await ensureAdmin();

  /*
    YASAKLAMA da token'lari iptal eder (2026-08-31). `isBanned` her istekte
    okundugu icin mobil uclar zaten aninda kapaniyordu, ama web oturumu farkli:
    Auth.js `jwt` cagrisi kullaniciyi YALNIZCA ilk girişte okuyordu, yani
    halihazirda acik bir oturum yasaklamadan etkilenmiyordu. `auth.ts`e eklenen
    periyodik yeniden dogrulama bunu kapatiyor; `tokenVersion` artisi ise
    beklemeyi de kaldirip yasagi aninda gecerli kiliyor.

    Yasagi KALDIRIRKEN de artiyor: zararsiz (kullanici zaten yeniden giris
    yapacak) ve kural "yasak durumu degisti -> oturumlar duser" seklinde tek
    parca kalıyor.
  */
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned, tokenVersion: { increment: 1 } },
  });

  writeAuditLog({
    actorUserId: session.user.id ?? null,
    actorRole: "ADMIN",
    action: "user.ban_toggle",
    entityType: "User",
    entityId: userId,
    metadata: { isBanned },
    ip: await clientIp(),
  });

  revalidatePathAllLocales("/admin/users");
  return { success: true };
}

async function countAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: Role.ADMIN } });
}

function involvesAdminRoleTransition(prev: Role, next: Role): boolean {
  return prev === Role.ADMIN || next === Role.ADMIN;
}

/** Admin rolünden çıkarma: sistemde en az 2 admin olmalı. */
async function assertDemotingAdminIsAllowed(
  targetUserId: string,
  newRole: Role,
): Promise<void> {
  if (newRole === Role.ADMIN) return;
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  });
  if (!target) throw new Error("not_found");
  if (target.role !== Role.ADMIN) return;
  const adminCount = await countAdmins();
  if (adminCount <= 1) {
    throw new Error("cannot_demote_sole_admin");
  }
}

async function applyUserRoleChange(params: {
  targetUserId: string;
  newRole: Role;
  actorUserId: string | null;
  ip: string | null;
  metadataExtra?: Record<string, unknown>;
}) {
  /*
    ROL DEGISIKLIGI TOKEN'LARI IPTAL EDER (2026-08-31'de eklendi).

    Onceden yalnizca `role` yaziliyordu. Rol, hem mobil JWT'nin (`role` istemi)
    hem de web oturum token'inin ICINDE tasiniyor; ikisi de imzali ve gecerli
    kaliyordu. Yani yetkisi ALINAN bir yonetici, elindeki token'lar suresi
    dolana kadar yonetici kalıyordu -- mobil erisim token'i 15 dakika, refresh
    token'i 30 GUN, web oturumu Auth.js varsayilaniyla 30 gun.

    `tokenVersion` artisi ucunu birden dusurur: `requireMobileUser`,
    `getMobileSession` ve web `jwt` yeniden dogrulamasi hepsi bu sayiyi
    karsilastiriyor. Yetki kaybi ANINDA gecerli olur; kullanici yeniden giris
    yapar ve YENI rolunu alir.
  */
  await prisma.user.update({
    where: { id: params.targetUserId },
    data: { role: params.newRole, tokenVersion: { increment: 1 } },
  });
  writeAuditLog({
    actorUserId: params.actorUserId,
    actorRole: "ADMIN",
    action: "user.role_update",
    entityType: "User",
    entityId: params.targetUserId,
    metadata: { newRole: params.newRole, ...params.metadataExtra },
    ip: params.ip,
  });
}

export type SubmitAdminRoleChangeResult =
  | { ok: true; applied: true }
  | { ok: true; pendingApproval: true }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "not_found"
        | "same_role"
        | "pending_exists"
        | "cannot_demote_sole_admin";
    };

/**
 * Rol değişikliği. Admin rolünü ilgilendiren geçişlerde: birden fazla admin varsa
 * ikinci bir admin onayı gerekir; yalnızca bir admin varsa anında uygulanır.
 * GUEST ↔ PARTNER gibi admin dışı geçişler her zaman anında.
 */
export async function submitAdminRoleChangeAction(
  targetUserId: string,
  newRole: Role,
): Promise<SubmitAdminRoleChangeResult> {
  const session = await ensureAdmin();
  const actorId = session.user?.id;
  if (!actorId || actorId === targetUserId) {
    return { ok: false, error: "unauthorized" };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "not_found" };
  if (target.role === newRole) return { ok: false, error: "same_role" };

  const ip = await clientIp();

  if (!involvesAdminRoleTransition(target.role, newRole)) {
    await applyUserRoleChange({
      targetUserId,
      newRole,
      actorUserId: actorId,
      ip,
    });
    revalidatePathAllLocales("/admin/users");
    return { ok: true, applied: true };
  }

  try {
    await assertDemotingAdminIsAllowed(targetUserId, newRole);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "cannot_demote_sole_admin") {
        return { ok: false, error: "cannot_demote_sole_admin" };
      }
      if (e.message === "not_found") {
        return { ok: false, error: "not_found" };
      }
    }
    throw e;
  }

  const admins = await countAdmins();
  if (admins === 1) {
    await applyUserRoleChange({
      targetUserId,
      newRole,
      actorUserId: actorId,
      ip,
      metadataExtra: { instantReason: "sole_admin" },
    });
    revalidatePathAllLocales("/admin/users");
    revalidatePathAllLocales("/admin/role-approvals");
    revalidatePathAllLocales("/admin");
    return { ok: true, applied: true };
  }

  try {
    await prisma.adminRoleChangeRequest.create({
      data: {
        targetUserId,
        previousRole: target.role,
        requestedRole: newRole,
        requestedByUserId: actorId,
      },
    });
  } catch (e) {
    if (isPrismaUniqueViolation(e)) {
      return { ok: false, error: "pending_exists" };
    }
    throw e;
  }

  writeAuditLog({
    actorUserId: actorId,
    actorRole: "ADMIN",
    action: "user.role_change_request",
    entityType: "User",
    entityId: targetUserId,
    metadata: {
      previousRole: target.role,
      requestedRole: newRole,
    },
    ip,
  });

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/role-approvals");
  revalidatePathAllLocales("/admin");
  return { ok: true, pendingApproval: true };
}

export type ApproveAdminRoleChangeResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_found"
        | "cannot_self_approve"
        | "stale"
        | "cannot_demote_sole_admin"
        | "unauthorized";
    };

export async function approveAdminRoleChangeAction(
  requestId: string,
): Promise<ApproveAdminRoleChangeResult> {
  const session = await ensureAdmin();
  const actorId = session.user?.id;
  if (!actorId) return { ok: false, error: "unauthorized" };

  const existing = await prisma.adminRoleChangeRequest.findUnique({
    where: { id: requestId },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.requestedByUserId === actorId) {
    return { ok: false, error: "cannot_self_approve" };
  }

  const ip = await clientIp();

  const txResult = await prisma.$transaction(async (tx) => {
    const reqRow = await tx.adminRoleChangeRequest.findUnique({
      where: { id: requestId },
    });
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

    // Rol degisikligi token'lari iptal eder -- gerekcesi `applyUserRoleChange`te.
    await tx.user.update({
      where: { id: user.id },
      data: { role: reqRow.requestedRole, tokenVersion: { increment: 1 } },
    });
    await tx.adminRoleChangeRequest.delete({ where: { id: requestId } });
    return { code: "ok" as const, targetId: user.id, newRole: reqRow.requestedRole };
  });

  if (txResult.code !== "ok") {
    if (
      txResult.code === "stale" ||
      txResult.code === "not_found" ||
      txResult.code === "cannot_demote_sole_admin"
    ) {
      revalidatePathAllLocales("/admin/role-approvals");
      revalidatePathAllLocales("/admin/users");
      revalidatePathAllLocales("/admin");
    }
    return { ok: false, error: txResult.code };
  }

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
    ip,
  });

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/role-approvals");
  revalidatePathAllLocales("/admin");
  return { ok: true };
}

export type CancelAdminRoleChangeResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "unauthorized" };

export async function cancelAdminRoleChangeAction(
  requestId: string,
): Promise<CancelAdminRoleChangeResult> {
  const session = await ensureAdmin();
  const actorId = session.user?.id;
  if (!actorId) return { ok: false, error: "unauthorized" };

  const row = await prisma.adminRoleChangeRequest.findUnique({
    where: { id: requestId },
  });
  if (!row) return { ok: false, error: "not_found" };

  await prisma.adminRoleChangeRequest.delete({ where: { id: requestId } });

  writeAuditLog({
    actorUserId: actorId,
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
    ip: await clientIp(),
  });

  revalidatePathAllLocales("/admin/role-approvals");
  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin");
  return { ok: true };
}

export type DeleteUserActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | typeof DELETE_USER_BLOCKED_CODE
        | "unauthorized"
        | typeof DELETE_USER_HAS_ACTIVE_BOOKING_CODE;
    };

/**
 * Kullanıcıyı tamamen sil. Tüm ilişkiler Cascade delete ile silinir.
 * Aktif bir rezervasyon (WAITING_APPROVAL, PENDING, PAID, vb.) var ise silinemez.
 * Dönüş değeri kullanılır; beklenen hatalar için throw edilmez (server action digest önlenir).
 */
export async function deleteUserAction(
  userId: string,
): Promise<DeleteUserActionResult> {
  const session = await ensureAdmin();

  if (session?.user?.id === userId) {
    return { ok: false, error: "unauthorized" };
  }

  // Kullanıcıyı bul
  const userToDelete = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true }
  });

  if (!userToDelete) {
    return { ok: true }; // Zaten yok
  }

  const activeStatuses: BookingStatus[] = ["WAITING_APPROVAL", "APPROVED", "PENDING", "PAID", "CHECKED_IN"];

  if (userToDelete.isBanned) {
    /*
      Banlıysa: açık rezervasyonları zorla iptal et, sonra sil.

      Eskiden burada ham `prisma.booking.updateMany({ status: "CANCELLED" })` vardı.
      Mobil "reddet" ucundaki hatanın aynısı: iade/ödeme niyeti kapatılmıyor,
      `ReservationSlot` satırları SİLİNMİYOR ve sadakat puanı geri alınmıyordu —
      yani yasaklanan bir esnafın dükkanı silinse bile o dükkanın slotları dolu
      görünmeye devam ediyordu. Artık her rezervasyon `cancelBooking`'den geçer.
    */
    const summary = await bookingService.forceCancelOpenBookingsForUser(
      userId,
      activeStatuses,
    );
    if (summary.failed > 0) {
      logger.warn(
        { userId, ...summary },
        "admin_delete_user_force_cancel_partial",
      );
    }
  } else {
    // Normal kullanıcı: Aktif rezervasyon kontrolü (silmeyi engelle)
    const activeBooking = await prisma.booking.findFirst({
      where: {
        status: { in: activeStatuses },
        OR: [
          { guestId: userId },
          { shop: { ownerId: userId } }
        ]
      }
    });

    if (activeBooking) {
      logger.warn({ userId, bookingId: activeBooking.id }, "admin_delete_user_blocked_active_booking");
      return { ok: false, error: DELETE_USER_HAS_ACTIVE_BOOKING_CODE };
    }
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    });
  } catch (e) {
    if (isPrismaForeignKeyViolation(e)) {
      logger.warn({ userId, err: e }, "admin_delete_user_fk_blocked");
      return { ok: false, error: DELETE_USER_BLOCKED_CODE };
    }
    throw e;
  }

  writeAuditLog({
    actorUserId: session.user.id ?? null,
    actorRole: "ADMIN",
    action: "user.delete",
    entityType: "User",
    entityId: userId,
    ip: await clientIp(),
  });

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/partners");
  return { ok: true };
}

/**
 * Doğrulama e-postasını tekrar gönder
 */
export async function resendVerificationEmailAction(email: string) {
  await ensureAdmin();

  // BUG-08: E-posta formatı doğrulanmadan token üretilebiliyordu
  const emailParsed = z.string().email().max(320).safeParse(email?.trim());
  if (!emailParsed.success) {
    return { success: false as const, error: "invalid_email" };
  }

  const locale = await getLocale();
  const verificationToken = await generateVerificationToken(emailParsed.data);
  await sendVerificationEmail(emailParsed.data, verificationToken.token, locale);

  return { success: true };
}

/**
 * Esnaf (Shop) onaylama
 *
 * NEDEN `shopService.approveShop` ÜZERİNDEN (2026-08-25): burası düz
 * `prisma.shop.update({ isActive: true })` çağırıyordu — dükkanı aktif
 * ediyordu ama partnere HİÇBİR bildirim gitmiyordu. `ShopService.approveShop`
 * aynı işi yaparken partnere onay e-postası + SMS'i de gönderiyor (P1-3'ün
 * düzeltmesi burada), e-postası doğrulanmamış eski kayıtları da düzeltiyor —
 * ama hiçbir çağıran onu kullanmıyordu (yalnızca kullanılmayan
 * `ApproveButton.tsx` üzerinden erişilebiliyordu). Sonuç: canlıda onaylanan
 * HER esnaf, panelinin açıldığını fark etmesi için hiçbir bildirim almadan
 * kalıyordu.
 */
export async function approveShopAction(shopId: string) {
  const session = await ensureAdmin();

  const success = await shopService.approveShop(shopId);
  if (!success) {
    throw new Error("Errors.generic");
  }

  writeAuditLog({
    actorUserId: session.user.id ?? null,
    actorRole: "ADMIN",
    action: "shop.approve_application",
    entityType: "Shop",
    entityId: shopId,
    ip: await clientIp(),
  });

  revalidatePathAllLocales("/admin/applications");
  revalidatePathAllLocales("/admin/partners");
  return { success: true };
}

export type RejectShopActionResult =
  | { success: true }
  | { success: false; error: "has_relations" };

/**
 * Esnaf (Shop) başvurusu reddet (sil). Bağlı rezervasyon vb. varsa FK hatası — digest yerine sonuç döner.
 */
export async function rejectShopAction(
  shopId: string,
): Promise<RejectShopActionResult> {
  await ensureAdmin();

  try {
    await prisma.shop.delete({
      where: { id: shopId },
    });
  } catch (e) {
    if (isPrismaForeignKeyViolation(e)) {
      logger.warn({ shopId, err: e }, "admin_reject_shop_fk_blocked");
      return { success: false, error: "has_relations" };
    }
    throw e;
  }

  revalidatePathAllLocales("/admin/applications");
  return { success: true };
}

/**
 * Esnaf (Shop) bilgilerini güncelle
 */
export async function updateShopAction(shopId: string, data: {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  pricePerDay?: number;
  isActive?: boolean;
  /**
   * Test/demo kaydı olarak işaretle. İşaretli dükkan kamuya açık arama, harita ve
   * ana sayfa istatistiklerinden düşer (`src/lib/public-shop-filter.ts`) ama
   * esnaf akışları çalışmaya devam eder.
   *
   * `isActive: false` yapmaktan FARKI budur: prod'daki test kaydının 5 rezervasyonu
   * var ve pasife almak esnaf tarafını bozuyordu (P1-4).
   */
  isTest?: boolean;
  /**
   * Misafire "Doğrulanmış" rozetini gösteren bayrak.
   *
   * NEDEN BURAYA EKLENDİ (P2-7, 2026-08-24): kolon şemada vardı, rozet üç
   * yüzeyde çiziliyordu, ama `src/` içinde onu YAZAN hiçbir kod yolu yoktu —
   * prod'daki tek `true` elle veritabanına girilmişti. Yani güven rozetinin
   * arkasında ne bir süreç ne de bir denetim izi vardı. `isTest` ile aynı
   * kalıp: admin bilinçli olarak veriyor ve değişiklik loglanıyor.
   */
  isVerified?: boolean;
}) {
  await ensureAdmin();

  /*
    Doğrulama hataları FIRLATILMIYOR, dönüyor.

    Neden (2026-08-24'te ölçüldü): Next 16'da bir server action'dan fırlayan hata
    istemciye kırpılarak gider — React yerine "An error occurred in the Server
    Components render. The specific message is omitted in production builds…"
    koyar. Yani yönetici geçersiz bir kapasite girdiğinde bu İngilizce paragrafı
    görüyordu; hangi alanın yanlış olduğu prod'a HİÇ ulaşmıyordu.
    `{ success: false, error }` dönüşü kırpılmaz. Projenin geri kalanı da bu
    kalıbı kullanıyor (`action-result-checked.test.ts` çağrı yerini denetler).
  */
  if (data.name !== undefined && !String(data.name).trim()) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  const lat =
    data.latitude === undefined
      ? undefined
      : typeof data.latitude === "number" && Number.isFinite(data.latitude)
        ? data.latitude
        : null;
  const lng =
    data.longitude === undefined
      ? undefined
      : typeof data.longitude === "number" && Number.isFinite(data.longitude)
        ? data.longitude
        : null;

  if (
    data.capacity !== undefined &&
    (!Number.isInteger(data.capacity) || data.capacity < 1 || data.capacity > 100_000)
  ) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  let pricePerDay: Prisma.Decimal | undefined;
  if (data.pricePerDay !== undefined) {
    if (!Number.isFinite(data.pricePerDay) || data.pricePerDay < 1 || data.pricePerDay > 1_000_000) {
      return { success: false as const, error: "Errors.invalidData" };
    }
    pricePerDay = new Prisma.Decimal(data.pricePerDay);
  }

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      name: data.name,
      address: data.address,
      latitude: lat,
      longitude: lng,
      capacity: data.capacity,
      pricePerDay,
      isActive: data.isActive,
      isTest: data.isTest,
      isVerified: data.isVerified,
    },
    /*
      `include: { owner: true }` KALDIRILDI (2026-08-31): getirilen `owner`
      nesnesi bu fonksiyonun hicbir yerinde OKUNMUYORDU -- tamamen bosa cekilen
      bir tam `User` satiriydi (`passwordHash` ve MB'lik base64 `image` dahil).
    */
  });

  if (data.isTest !== undefined) {
    // Bir dükkanı kamuya açık yüzeylerden düşürmek/geri getirmek denetlenmeli.
    logger.info(
      { shopId, isTest: data.isTest, shopName: shop.name },
      "admin_shop_test_flag_changed",
    );
  }

  if (data.isVerified !== undefined) {
    // Güven rozeti misafire verilen bir iddiadır; kimin ne zaman verdiği yazılı olmalı.
    logger.info(
      { shopId, isVerified: data.isVerified, shopName: shop.name },
      "admin_shop_verified_flag_changed",
    );
  }

  try {
    revalidatePathAllLocales(`/admin/partners/${shopId}/edit`);
    revalidatePathAllLocales(`/admin/partners/${shopId}`);
    revalidatePathAllLocales("/admin/partners");
    revalidatePathAllLocales("/search");
  } catch (e) {
    logger.error({ shopId, err: e }, "revalidate_after_shop_update_failed");
  }
  return { success: true as const };
}

/**
 * Yorum sil (Admin için)
 */
export async function deleteReviewAction(reviewId: string) {
  await ensureAdmin();

  const review = await prisma.review.delete({
    where: { id: reviewId },
    select: { shopId: true },
  });

  // BUG-10: Yorum silindiğinde dükkan ortalama puanı güncellenmeli
  const aggregations = await prisma.review.aggregate({
    where: { shopId: review.shopId },
    _avg: { rating: true },
  });
  await prisma.shop.update({
    where: { id: review.shopId },
    data: { rating: aggregations._avg.rating ?? 0 },
  });

  revalidatePathAllLocales(`/admin/partners/${review.shopId}/edit`);
  revalidatePathAllLocales("/search");
  return { success: true };
}

/**
 * IP blokla
 */
export async function blockIpAction(ip: string, reason?: string) {
  await ensureAdmin();

  // BUG-18: IP formatı doğrulanmalıdır (Zod uyumluluğu için regex kullanıldı)
  const ipSchema = z.string().min(7).max(45).regex(/^[a-fA-F0-9:.]+$/);
  const ipParsed = ipSchema.safeParse(ip?.trim());
  if (!ipParsed.success) {
    return { success: false, error: "invalid_ip_format" };
  }

  await prisma.blockedIp.upsert({
    where: { ip: ipParsed.data },
    update: { reason: reason?.trim() || null },
    create: { ip: ipParsed.data, reason: reason?.trim() || null },
  });

  revalidatePathAllLocales("/admin/settings");
  return { success: true };
}
