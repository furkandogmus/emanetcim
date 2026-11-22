"use server";

import { getClientIpOrNull } from "@/lib/client-ip";

import prisma from "@/lib/db";
import { shopService, type AdminShopUpdate } from "@/services/ShopService";
import { reviewService } from "@/services/ReviewService";
import { adminUserService } from "@/services/AdminUserService";
import { BookingStatus, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import logger from "@/lib/logger";
import { bookingService } from "@/services/BookingService";
import { getLocale } from "next-intl/server";
import { writeAuditLog } from "@/lib/audit-log";
import { isPrismaForeignKeyViolation } from "@/lib/prisma-errors";
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



/**
 * Kullanıcıyı banla veya banını kaldır
 */
export async function toggleUserBanAction(userId: string, isBanned: boolean) {
  const session = await ensureAdmin();
  // Govde `AdminUserService.setBanned`ta (token iptali + denetim kaydi); mobil admin de oradan gecer.
  const result = await adminUserService.setBanned(userId, isBanned, {
    userId: session.user.id ?? null,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) {
    return { success: false as const, error: result.error === "cannot_ban_self" ? "cannotBanSelf" : "notFound" };
  }

  revalidatePathAllLocales("/admin/users");
  return { success: true as const };
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
  // Govde `AdminUserService.changeRole`ta (son admin / kendi rolu / ikinci onay); mobil admin de oradan gecer.
  const result = await adminUserService.changeRole(targetUserId, newRole, {
    userId: session.user?.id ?? null,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) {
    return { ok: false, error: result.error === "cannot_change_self" ? "unauthorized" : result.error };
  }

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/role-approvals");
  revalidatePathAllLocales("/admin");
  return result.status === "applied" ? { ok: true, applied: true } : { ok: true, pendingApproval: true };
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

  const ip = await getClientIpOrNull();

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
    ip: await getClientIpOrNull(),
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
    /*
      KAPATILAMAYAN REZERVASYON KALDIYSA SILME YAPILMAZ.

      Onceki hali yalnizca UYARI yaziyor ve silmeye devam ediyordu. Ama
      `cancelBooking` `CHECKED_IN` durumunu bilerek REDDEDIYOR -- valiz o anda
      fiziksel olarak dukkanin rafinda ve iptal onu ortadan kaldirmaz. Yani
      zorla iptal tam olarak bu durumda basarisiz oluyor ve hesap yine de
      siliniyordu:

        esnafin rafinda valiz var, sahibi kayitta yok
        `Booking.guestId` bosalir, `guest` iliskisi kaybolur
        hesapli misafirde `guestEmail`/`guestPhone` zaten null
        -> esnaf valizi kime teslim edecegini, kime haber verecegini bilemez

      Ayni koruma NORMAL kullanicida zaten vardi (asagidaki dal): aktif
      rezervasyonu olan hesap silinmiyor. Yasakli hesapta yoktu -- yasaklamak,
      valizi dukkandan kaldirmiyor.
    */
    if (summary.failed > 0) {
      logger.warn(
        { userId, ...summary },
        "admin_delete_user_blocked_uncancellable_booking",
      );
      return { ok: false, error: DELETE_USER_HAS_ACTIVE_BOOKING_CODE };
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
    ip: await getClientIpOrNull(),
  });

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/partners");
  return { ok: true };
}

/**
 * Doğrulama e-postasını tekrar gönder
 */
export async function resendVerificationEmailAction(email: string) {
  const session = await ensureAdmin();

  // Govde `AdminUserService.resendVerificationEmail`ta (bicim, dogrulanmis hesap, denetim kaydi).
  const result = await adminUserService.resendVerificationEmail(
    email ?? "",
    { userId: session.user.id ?? null, ip: await getClientIpOrNull() },
    await getLocale(),
  );
  if (!result.ok) return { success: false as const, error: result.error };
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

  /*
    `if (!success)` DEGIL: `approveShop` yapilandirilmis sonuc donuyor ve bir
    NESNE her zaman truthy -- eski kosul hicbir hatayi yakalamazdi ve
    TypeScript bunu uyarmaz. Sebep de tasiniyor: "konum yok" ile "dukkan yok"
    admin icin ayri seyler, ilki duzeltilebilir bir eksik.
  */
  const result = await shopService.approveApplication(shopId, {
    userId: session.user.id ?? null,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) {
    throw new Error(
      result.reason === "missing_coordinates"
        ? "Errors.shopMissingCoordinates"
        : "Errors.generic",
    );
  }

  revalidatePathAllLocales("/admin/applications");
  revalidatePathAllLocales("/admin/partners");
  return { success: true };
}

export type RejectShopActionResult =
  | { success: true }
  | { success: false; error: "has_relations" | "not_pending" };

/**
 * Esnaf (Shop) başvurusu reddet (sil). Bağlı rezervasyon vb. varsa FK hatası — digest yerine sonuç döner.
 */
export async function rejectShopAction(
  shopId: string,
): Promise<RejectShopActionResult> {
  const session = await ensureAdmin();

  /*
    GOVDE ARTIK SERVISTE (2026-09-01). Burasi dukkani siliyor ama MUHURLERI
    STOGA DONDURMUYORDU: reddedilen dukkana ATANMIS muhurler, dukkan silindikten
    sonra da atanmis gorunuyor ve envanterden sessizce dusuyordu. Mobil uc ayni
    islemi dogru yapiyordu -- iki kopya, iki farkli eksik. Bkz.
    `ShopService.rejectShop`.

    Aktif rezervasyon kontrolu de artik ACIK: onceki hal FK ihlaline
    guveniyordu, oysa silme `onDelete` davranisina gore BASARILI da olabilir ve
    o durumda misafirin elinde karsiligi olmayan bir rezervasyon kalirdi.
  */
  // Denetim kaydi `rejectApplication`da: mobil uc da ayni yoldan gecer.
  const result = await shopService.rejectApplication(shopId, {
    userId: session.user.id ?? null,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) {
    logger.warn({ shopId, reason: result.reason }, "admin_reject_shop_blocked");
    return {
      success: false,
      error: result.reason === "not_pending" ? "not_pending" : "has_relations",
    };
  }

  revalidatePathAllLocales("/admin/applications");
  return { success: true };
}

/**
 * Esnaf (Shop) bilgilerini güncelle
 */
export async function updateShopAction(shopId: string, data: AdminShopUpdate) {
  const session = await ensureAdmin();

  // Govde `ShopService.adminUpdateShop`ta: mobil admin ucu da ayni kurali kullanir.
  const result = await shopService.adminUpdateShop(shopId, data, {
    userId: session.user.id ?? null,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) return { success: false as const, error: result.error };

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

  /*
    BUG-10: yorum silinince dukkan ortalama puani guncellenmeli.

    GOVDE ARTIK SERVISTE (2026-09-01). Burasi `ReviewService`teki hesabin satir
    ici bir KOPYASINI tasiyordu -- ayni `aggregate`, ayni `update`. Ayni sayiyi
    iki yerde hesaplamak, bu kod tabaninin tekrar tekrar duzelttigi sinif:
    birinin filtresi degistiginde digeri sessizce geride kalir.
  */
  await reviewService.updateShopAverageRating(review.shopId);

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
