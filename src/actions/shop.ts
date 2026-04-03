"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";

export async function updateShopSettingsAction(shopId: string, data: {
  capacity?: number;
  openingTime?: string;
  closingTime?: string;
  pricePerDay?: number;
}) {
  const session = await auth();
  
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Önce dükkanın sahibi mi kontrol et
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop || shop.ownerId !== session.user.id) {
    if (session.user.role !== 'ADMIN') throw new Error("Unauthorized");
  }

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      ...data,
      updatedAt: new Date()
    }
  });

  revalidatePathAllLocales("/partner");
  revalidatePathAllLocales("/partner/settings");
  revalidatePathAllLocales("/partner/bookings");
  return { success: true };
}
