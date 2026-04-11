"use server";

import prisma from "@/lib/db";
import { auth } from "@/auth";
import { Prisma, Role } from "@prisma/client";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { paymentService } from "@/services/PaymentService";
import logger from "@/lib/logger";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { getLocale } from "next-intl/server";

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

/**
 * Kullanıcıyı banla veya banını kaldır
 */
export async function toggleUserBanAction(userId: string, isBanned: boolean) {
  await ensureAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { isBanned },
  });

  revalidatePathAllLocales("/admin/users");
  return { success: true };
}

/**
 * Kullanıcı rolünü güncelle (Örn: GUEST -> ADMIN)
 */
export async function updateUserRoleAction(userId: string, newRole: Role) {
  await ensureAdmin();

  // Kendi rolünü değiştirmeyi engelle (Güvenlik için)
  const session = await auth();
  if (session?.user?.id === userId) {
    throw new Error("Errors.unauthorized");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  revalidatePathAllLocales("/admin/users");
  return { success: true };
}

/**
 * Kullanıcıyı tamamen sil (Cascade silme ile ilişkili kayıtlar da silinir)
 */
export async function deleteUserAction(userId: string) {
  await ensureAdmin();

  // Kendi hesabını siliyorsa engelle
  const session = await auth();
  if (session?.user?.id === userId) {
    throw new Error("Errors.unauthorized");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePathAllLocales("/admin/users");
  revalidatePathAllLocales("/admin/partners");
  return { success: true };
}

/**
 * Doğrulama e-postasını tekrar gönder
 */
export async function resendVerificationEmailAction(email: string) {
  await ensureAdmin();

  const locale = await getLocale();
  const verificationToken = await generateVerificationToken(email);
  await sendVerificationEmail(email, verificationToken.token, locale);

  return { success: true };
}

/**
 * Esnaf (Shop) onaylama
 */
export async function approveShopAction(shopId: string) {
  await ensureAdmin();

  await prisma.shop.update({
    where: { id: shopId },
    data: { isActive: true },
  });

  revalidatePathAllLocales("/admin/applications");
  revalidatePathAllLocales("/admin/partners");
  return { success: true };
}

/**
 * Esnaf (Shop) başvurusu reddet (Sil)
 */
export async function rejectShopAction(shopId: string) {
  await ensureAdmin();

  await prisma.shop.delete({
    where: { id: shopId },
  });

  revalidatePathAllLocales("/admin/applications");
  return { success: true };
}

/**
 * Esnaf (Shop) sil
 */
export async function deleteShopAction(shopId: string) {
  await ensureAdmin();

  await prisma.shop.delete({
    where: { id: shopId },
  });

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

