import { randomUUID } from "crypto";
import { Role } from "@prisma/client";

import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { buildObjectKey, getStorage, validateImageBytes } from "@/lib/storage";
import { extractKeyFromUrl } from "@/services/ShopService";

/**
 * Dukkan galerisi: kapak (`Shop.image`) disindaki fotograflar (`ShopImage`).
 *
 * Tablo ve web vitrini (`getShopImages`) vardi ama tabloya YAZAN bir yol yoktu:
 * esnaf tek kapak fotografi koyabiliyordu, misafir dukkanin icini, rafini ya da
 * kapisini goremiyordu. Yukleme `setShopImage` ile ayni sirayla: sahiplik ->
 * gorsel dogrulama -> S3 -> satir.
 */
export const MAX_GALLERY_IMAGES = 8;

type Actor = { shopId: string; actorId: string; actorRole: Role };

export type GalleryFailure =
  | "not_found"
  | "not_owner"
  | "limit"
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "dimensions_too_large";

async function ownShop({ shopId, actorId, actorRole }: Actor) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerId: true, image: true } });
  if (!shop) return { ok: false as const, reason: "not_found" as const };
  if (shop.ownerId !== actorId && actorRole !== Role.ADMIN) return { ok: false as const, reason: "not_owner" as const };
  return { ok: true as const, cover: shop.image };
}

function removeObject(url: string, context: Record<string, unknown>) {
  const storage = getStorage();
  const key = extractKeyFromUrl(url, storage);
  if (!key) return;
  void storage.remove(key).catch((err: unknown) => logger.warn({ err, ...context, key }, "shop_gallery_cleanup_failed"));
}

export class ShopGalleryService {
  async list(shopId: string) {
    return prisma.shopImage.findMany({
      where: { shopId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, url: true },
      take: MAX_GALLERY_IMAGES,
    });
  }

  async add(params: Actor & { bytes: Uint8Array }): Promise<{ ok: true; id: string; url: string } | { ok: false; reason: GalleryFailure }> {
    const owner = await ownShop(params);
    if (!owner.ok) return owner;

    const count = await prisma.shopImage.count({ where: { shopId: params.shopId } });
    if (count >= MAX_GALLERY_IMAGES) return { ok: false, reason: "limit" };

    const validation = validateImageBytes(params.bytes);
    if (!validation.ok) return { ok: false, reason: validation.reason };

    const storage = getStorage();
    const key = buildObjectKey({
      prefix: "shops",
      ownerId: params.shopId,
      uniqueId: randomUUID(),
      extension: validation.extension,
    });
    const { url } = await storage.put({ key, body: params.bytes, contentType: validation.contentType });

    const last = await prisma.shopImage.findFirst({
      where: { shopId: params.shopId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const row = await prisma.shopImage.create({
      data: { shopId: params.shopId, url, order: (last?.order ?? -1) + 1 },
      select: { id: true, url: true },
    });
    return { ok: true, ...row };
  }

  async remove(params: Actor & { imageId: string }): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_owner" }> {
    const owner = await ownShop(params);
    if (!owner.ok) return owner;
    const image = await prisma.shopImage.findFirst({
      where: { id: params.imageId, shopId: params.shopId },
      select: { url: true },
    });
    if (!image) return { ok: false, reason: "not_found" };
    await prisma.shopImage.delete({ where: { id: params.imageId } });
    // Satir once silinir: nesne silme basarisiz olursa yalnizca yetim nesne kalir.
    removeObject(image.url, { shopId: params.shopId });
    return { ok: true };
  }

  /**
   * Galerideki fotografi kapak yapar; eski kapak galeriye, onun yerine gecer.
   * Hicbir nesne silinmez ya da yuklenmez, yalnizca iki adres yer degistirir.
   */
  async makeCover(params: Actor & { imageId: string }): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_owner" }> {
    const owner = await ownShop(params);
    if (!owner.ok) return owner;
    const image = await prisma.shopImage.findFirst({
      where: { id: params.imageId, shopId: params.shopId },
      select: { url: true },
    });
    if (!image) return { ok: false, reason: "not_found" };

    await prisma.$transaction([
      prisma.shop.update({ where: { id: params.shopId }, data: { image: image.url } }),
      owner.cover
        ? prisma.shopImage.update({ where: { id: params.imageId }, data: { url: owner.cover } })
        : prisma.shopImage.delete({ where: { id: params.imageId } }),
    ]);
    return { ok: true };
  }
}

export const shopGalleryService = new ShopGalleryService();
