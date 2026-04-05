"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { getPricingRules } from "@/lib/platform-settings";
import { z } from "zod";

const hm = /^\d{1,2}:\d{2}$/;

const shopSettingsSchema = z.object({
  capacity: z.number().int().min(1).max(100_000).optional(),
  openingTime: z.string().regex(hm, "Saat HH:mm olmalıdır.").optional(),
  closingTime: z.string().regex(hm, "Saat HH:mm olmalıdır.").optional(),
  pricePerDay: z.number().min(0).max(1_000_000).optional(),
});

export async function updateShopSettingsAction(
  shopId: string,
  data: {
    capacity?: number;
    openingTime?: string;
    closingTime?: string;
    pricePerDay?: number;
  }
) {
  const session = await auth();

  if (!session?.user?.id) throw new Error("Unauthorized");

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop || shop.ownerId !== session.user.id) {
    if (session.user.role !== "ADMIN") throw new Error("Unauthorized");
  }

  const parsed = shopSettingsSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.flatten().formErrors[0] ?? "Geçersiz veri.";
    throw new Error(first);
  }

  if (parsed.data.pricePerDay !== undefined) {
    const rules = await getPricingRules();
    const minPrice = Math.round(rules.defaultPricePerDay / 2);
    const maxPrice = rules.defaultPricePerDay * 2;
    if (parsed.data.pricePerDay < minPrice || parsed.data.pricePerDay > maxPrice) {
      throw new Error(`Birim fiyat ${minPrice}₺ ile ${maxPrice}₺ arasında olmalıdır.`);
    }
  }

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      ...parsed.data,
      updatedAt: new Date(),
    },
  });

  revalidatePathAllLocales("/partner");
  revalidatePathAllLocales("/partner/settings");
  revalidatePathAllLocales("/partner/bookings");
  return { success: true };
}
