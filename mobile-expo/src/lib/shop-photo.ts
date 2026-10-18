import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Vitrin fotografi sunucuya gitmeden once JPEG'e cevrilip kucultulur.
 *
 * Sunucu (`validateImageBytes`) 8 MB, kenar basina 6000 px, toplam 24 MP ve yalnizca
 * JPEG/PNG/WebP kabul ediyor. Telefon kamerasinin fotografi (50 MP) ve bircok
 * Android'in sakladigi HEIC bu sinirlara takiliyordu; esnafin denemesi S3'e hic
 * ulasmadan reddedildi (2026-10-18). `quality` secenegi yalnizca sikistirir,
 * kucultmez; asil is burada.
 */
export const MAX_PHOTO_EDGE = 2048;

export type UploadFile = { uri: string; name: string; type: string };

/** Uzun kenar sinirin ustundeyse orantili kucultme hedefi; degilse `null`. */
export function resizeTarget(width: number, height: number, max = MAX_PHOTO_EDGE) {
  if (!(width > 0 && height > 0) || Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

export async function prepareShopPhoto(asset: { uri: string; width: number; height: number }): Promise<UploadFile> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const target = resizeTarget(asset.width, asset.height);
  if (target) ctx.resize(target);
  const image = await ctx.renderAsync();
  // Her zaman JPEG: HEIC/HEIF de bu yoldan gecince sunucunun kabul ettigi ture doner.
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  return { uri: out.uri, name: "shop.jpg", type: "image/jpeg" };
}
