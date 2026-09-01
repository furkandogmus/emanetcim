"use server";

import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { getPricingRules } from "@/lib/platform-settings";
import { z } from "zod";
import { requireUser, requirePartner } from "@/lib/action-auth";
import { shopService } from "@/services/ShopService";
import { shopSettingsImpactService } from "@/services/ShopSettingsImpact";

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

  /*
    ETKI, YAZMADAN ONCE olculuyor: yazdiktan sonra "eski saatlere gore kac
    rezervasyon disarida kaliyordu" sorusu artik sorulamaz.

    Degisiklik ENGELLENMIYOR -- esnafin saatini degistirme hakki var ve
    dukkanini kapatmasi gerekebilir. Dogru olan sonucu SOYLEMEK, boylece esnaf
    etkilenen misafirlere ulasabilir. Bkz. `ShopSettingsImpact`.
  */
  const impact = await shopSettingsImpactService.assess({
    shopId,
    openingTime: parsed.data.openingTime,
    closingTime: parsed.data.closingTime,
    capacity: parsed.data.capacity,
  });

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
  return { success: true, impact };
}

/**
 * Dükkan vitrin fotoğrafını yükler.
 *
 * `FormData` alıyor çünkü dosya taşıyan tek server action biçimi bu. Gövde
 * `ShopService.setShopImage`de: sahiplik → doğrulama → yükleme sırası ve
 * eski nesnenin temizliği orada.
 *
 * TÜR SUNUCUDA BELİRLENİYOR: `file.type` istemcinin beyanıdır ve hiç
 * okunmuyor; `validateImageBytes` ilk baytlara bakıyor.
 */
export async function updateShopImageAction(formData: FormData) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const shopId = formData.get("shopId");
  const file = formData.get("file");
  if (typeof shopId !== "string" || !shopId || !(file instanceof File)) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await shopService.setShopImage({
    shopId,
    actorId: auth.actor.id,
    actorRole: auth.actor.role,
    bytes,
  });

  if (!result.ok) {
    const ERROR_KEYS = {
      not_found: "Errors.shopNotFound",
      not_owner: "Errors.unauthorized",
      empty: "Errors.invalidData",
      too_large: "Errors.imageTooLarge",
      unsupported_type: "Errors.imageUnsupportedType",
    } as const;
    return { success: false as const, error: ERROR_KEYS[result.reason] };
  }

  revalidatePathAllLocales("/partner/settings");
  revalidatePathAllLocales(`/shop/${shopId}`);
  return { success: true as const, url: result.url };
}
