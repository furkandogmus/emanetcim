"use server";

import prisma from "@/lib/db";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";

/**
 * Admin koruması sağlayan yardımcı fonksiyon
 */
async function ensureAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    throw new Error("Yetkisiz işlem: Sadece yöneticiler bu işlemi gerçekleştirebilir.");
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

  revalidatePath("/admin/users");
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
    throw new Error("Kendi hesabınızı silemezsiniz.");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/partners");
  return { success: true };
}

/**
 * Doğrulama e-postasını tekrar gönder
 */
export async function resendVerificationEmailAction(email: string) {
  await ensureAdmin();

  const verificationToken = await generateVerificationToken(email);
  await sendVerificationEmail(email, verificationToken.token);

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

  revalidatePath("/admin/applications");
  revalidatePath("/admin/partners");
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

  revalidatePath("/admin/applications");
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

  revalidatePath("/admin/partners");
  revalidatePath("/admin/applications");
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

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      name: data.name,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      capacity: data.capacity,
      pricePerDay: data.pricePerDay,
      isActive: data.isActive,
    },
  });

  revalidatePath(`/admin/partners/${shopId}`);
  revalidatePath("/admin/partners");
  revalidatePath("/search"); // Arama sonuçlarındaki fiyat/konum değişikliği için
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

  revalidatePath(`/admin/partners/${review.shopId}/edit`);
  revalidatePath("/search");
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
