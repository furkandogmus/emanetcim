import { S3Storage, type S3Config } from "./s3";
import type { StoragePort } from "./types";

export * from "./types";
export * from "./image-validation";
export { S3Storage } from "./s3";

/**
 * Aktif depolama sağlayıcısını çözer — `src/lib/payments/index.ts` ile aynı kural.
 *
 * YAPILANDIRILMAMIŞSA SESSİZCE BİR ŞEYE DÜŞMEZ, ATAR. Sebep: "fotoğraf
 * yüklendi" deyip hiçbir yere yazmamak, tam olarak bu kod tabanını bu hâle
 * getiren hata sınıfıdır (yanlış varsayılan = gerçekmiş gibi görünen sonuç).
 * Yükleme yüzeyi, depolama gerçekten hazır olmadan AÇILMAMALI.
 *
 * `isStorageConfigured()` ise ATMADAN sorar: arayüz, yükleme düğmesini
 * gösterip göstermeyeceğine buna bakarak karar verir — kullanıcıya
 * çalışmayacak bir düğme göstermemek için.
 */

const REQUIRED = [
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_BASE_URL",
] as const;

function readConfig(): S3Config | null {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) return null;
  return {
    bucket: process.env.S3_BUCKET!.trim(),
    region: process.env.S3_REGION!.trim(),
    accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL!.trim(),
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
  };
}

/** Depolama kullanılabilir mi? Arayüz yükleme düğmesini buna göre çizer. */
export function isStorageConfigured(): boolean {
  return readConfig() !== null;
}

let cached: StoragePort | null = null;

export function getStorage(): StoragePort {
  if (cached) return cached;
  const config = readConfig();
  if (!config) {
    const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
    throw new Error(
      `Storage is not configured. Missing: ${missing.join(", ")}`,
    );
  }
  cached = new S3Storage(config);
  return cached;
}

/** Yalnızca test içindir. */
export function __resetStorageCache(): void {
  cached = null;
}
