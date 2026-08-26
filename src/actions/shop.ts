"use server";

import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { getPricingRules } from "@/lib/platform-settings";
import { z } from "zod";
import { requireUser } from "@/lib/action-auth";

const hm = /^\d{1,2}:\d{2}$/;

const shopSettingsSchema = z.object({
  capacity: z.number().int().min(1).max(100_000).optional(),
  openingTime: z.string().regex(hm, "Saat HH:mm olmalıdır.").optional(),
  closingTime: z.string().regex(hm, "Saat HH:mm olmalıdır.").optional(),
  pricePerDay: z.number().min(0).max(1_000_000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export async function updateShopSettingsAction(
  shopId: string,
  data: {
    capacity?: number;
    openingTime?: string;
    closingTime?: string;
    pricePerDay?: number;
    address?: string;
    city?: string;
    district?: string;
    latitude?: number | null;
    longitude?: number | null;
  }
) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { ownerId: true },
  });

  if (!shop) return { success: false, error: "Errors.shopNotFound" };

  if (shop.ownerId !== auth.actor.id) {
    if (auth.actor.role !== "ADMIN") return { success: false, error: "Errors.unauthorized" };
  }

  const parsed = shopSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Errors.invalidData" };
  }

  if (parsed.data.pricePerDay !== undefined) {
    const rules = await getPricingRules();
    const minPrice = Math.round(rules.defaultPricePerDay / 2);
    const maxPrice = rules.defaultPricePerDay * 2;
    if (parsed.data.pricePerDay < minPrice || parsed.data.pricePerDay > maxPrice) {
      return { success: false, error: "Errors.invalidData" };
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
