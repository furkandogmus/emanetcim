"use server";

import prisma from "@/lib/db";
import { auth } from "@/auth";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { paymentService } from "@/services/PaymentService";
import logger from "@/lib/logger";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { writeAuditLog } from "@/lib/audit-log";
import {
  isPrismaForeignKeyViolation,
  isPrismaUniqueViolation,
} from "@/lib/prisma-errors";
import { DELETE_USER_BLOCKED_CODE } from "@/lib/admin/constants";

/**
 * Admin koruması sağlayan yardımcı fonksiyon
 */
async function ensureAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    throw new Error("Errors.notAuthorizedAdmin");
  }
  return session;
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

  await prisma.user.update({
    where: { id: userId },
    data: { isBanned },
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
  await prisma.user.update({
    where: { id: params.targetUserId },
    data: { role: params.newRole },
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

    await tx.user.update({
      where: { id: user.id },
      data: { role: reqRow.requestedRole },
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
      error: typeof DELETE_USER_BLOCKED_CODE | "unauthorized";
    };

/**
 * Kullanıcıyı tamamen sil. İlişkili rezervasyon vb. varsa FK (P2003 / PG 23503) — silinmez.
 * Dönüş değeri kullanılır; beklenen hatalar için throw edilmez (server action digest önlenir).
 */
export async function deleteUserAction(
  userId: string,
): Promise<DeleteUserActionResult> {
  const session = await ensureAdmin();

  if (session?.user?.id === userId) {
    return { ok: false, error: "unauthorized" };
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
 */
export async function approveShopAction(shopId: string) {
  const session = await ensureAdmin();

  await prisma.shop.update({
    where: { id: shopId },
    data: { isActive: true },
  });

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

export type DeleteShopActionResult =
  | { success: true }
  | { success: false; error: "has_relations" };

/**
 * Esnaf (Shop) sil
 */
export async function deleteShopAction(
  shopId: string,
): Promise<DeleteShopActionResult> {
  await ensureAdmin();

  try {
    await prisma.shop.delete({
      where: { id: shopId },
    });
  } catch (e) {
    if (isPrismaForeignKeyViolation(e)) {
      logger.warn({ shopId, err: e }, "admin_delete_shop_fk_blocked");
      return { success: false, error: "has_relations" };
    }
    throw e;
  }

  revalidatePathAllLocales("/admin/partners");
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
}) {
  await ensureAdmin();

  if (data.name !== undefined && !String(data.name).trim()) {
    throw new Error("Errors.invalidData");
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
    throw new Error("Errors.invalidData");
  }

  let pricePerDay: Prisma.Decimal | undefined;
  if (data.pricePerDay !== undefined) {
    if (!Number.isFinite(data.pricePerDay) || data.pricePerDay < 1 || data.pricePerDay > 1_000_000) {
      throw new Error("Errors.invalidData");
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
    },
    include: { owner: true },
  });

  // Iyzico Sub-Merchant Sync (Sadece anahtar varsa)
  if (shop.subMerchantKey && (data.name || data.address)) {
    try {
      await paymentService.updateSubMerchant({
        subMerchantKey: shop.subMerchantKey,
        name: data.name || shop.name,
        address: data.address || shop.address || "Istanbul",
        email: shop.owner.email || "partner@bagajpark.local",
        phone: shop.owner.phone || "+905000000000",
      });
    } catch (error) {
      logger.error({ shopId, error }, "iyzico_submerchant_sync_failed");
      // Not: Ödeme servisi hatası ana işlemi bozmasın diye try-catch içindeyiz.
    }
  }

  try {
    revalidatePathAllLocales(`/admin/partners/${shopId}/edit`);
    revalidatePathAllLocales(`/admin/partners/${shopId}`);
    revalidatePathAllLocales("/admin/partners");
    revalidatePathAllLocales("/search");
  } catch (e) {
    logger.error({ shopId, err: e }, "revalidate_after_shop_update_failed");
  }
  return { success: true };
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

  await prisma.blockedIp.upsert({
    where: { ip },
    update: { reason },
    create: { ip, reason },
  });

  return { success: true };
}

/**
 * IP bloğunu kaldır
 */
export async function unblockIpAction(ip: string) {
  await ensureAdmin();

  await prisma.blockedIp.delete({
    where: { ip },
  });

  return { success: true };
}

type PaymentChargebackStatus = "OPEN" | "WON" | "LOST";

/**
 * Ödeme kaydı için chargeback durumu (admin).
 */
export async function setPaymentChargebackStatusAction(
  bookingId: string,
  status: PaymentChargebackStatus | null,
  note?: string | null,
) {
  const session = await ensureAdmin();

  const log = await prisma.paymentLog.findUnique({
    where: { bookingId },
  });
  if (!log) {
    return { success: false as const, error: "payment_log_not_found" as const };
  }

  await prisma.paymentLog.update({
    where: { id: log.id },
    data: {
      chargebackStatus: status,
      chargebackNote: note?.trim() || null,
    },
  });

  writeAuditLog({
    actorUserId: session.user.id ?? null,
    actorRole: "ADMIN",
    action: "payment.chargeback_update",
    entityType: "PaymentLog",
    entityId: log.id,
    metadata: { bookingId, status, note: note ?? null },
    ip: await clientIp(),
  });

  return { success: true as const };
}

