import logger from "@/lib/logger";
import { getStorage, isStorageConfigured } from "./index";

/**
 * Eskiden herkese acik adresle KAYDEDILEN ama kova politikasinin hic acmadigi onekler
 * (yalniz `shops/*` herkese acik). Satirlar bugunku haliyle (tam adres) kalir; gosterim
 * yetki kontrolunden SONRA bu yardimciyla 5 dk'lik imzali adrese cevrilir.
 */
export type PrivateReadPrefix = "seals/" | "team-issues/";

export const PRIVATE_READ_TTL_SECONDS = 5 * 60;

/** Kayitli deger (tam adres ya da anahtar) bu onekte bir nesneyse anahtari; degilse `null`. */
export function storedObjectKey(value: string | null | undefined, prefix: PrivateReadPrefix): string | null {
  if (!value) return null;
  let key = value;
  if (/^https?:\/\//i.test(value)) {
    const base = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
    if (!base || !value.startsWith(`${base}/`)) return null;
    key = value.slice(base.length + 1).split(/[?#]/)[0];
  }
  // Yol gecisi ve baska onek: imza yalniz istenen onekteki nesneye atilir.
  if (!key.startsWith(prefix) || key.includes("..") || key.includes("//")) return null;
  return key;
}

/**
 * Gosterilecek adres. `data:` (depolama yokken ekip sorunu fotografi boyle saklaniyor)
 * oldugu gibi doner; bu onekteki nesne imzalanir; taninmayan her sey `null` (baska bir
 * sunucunun adresi kanit diye cizilmez). CAGIRAN yetkiyi zaten dogrulamis olmali.
 */
export async function presignStoredImage(
  value: string | null | undefined,
  prefix: PrivateReadPrefix,
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  const key = storedObjectKey(value, prefix);
  if (!key || !isStorageConfigured()) return null;
  try {
    return await getStorage().presignGet(key, PRIVATE_READ_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, prefix }, "private_image_presign_failed");
    return null;
  }
}
