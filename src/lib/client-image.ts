/**
 * Vitrin fotografi sunucuya gitmeden once tarayicida JPEG'e cevrilip kucultulur.
 *
 * NEDEN (2026-10-18): admin "Ersoy Aga Otel"e 3,2 MB'lik bir PNG ekran goruntusu
 * yuklemek istedi; Cloudflare WAF istegi 403 ile kesti, sunucuya hic ulasmadi.
 * Ayni gorsel JPEG olunca gecti. Kucuk JPEG hem bu yanlis pozitife takilmiyor hem
 * sunucunun 8 MB / 6000 px sinirinin cok altinda kaliyor. Mobil uygulama ayni
 * kurali `mobile-expo/src/lib/shop-photo.ts`te uyguluyor.
 */
export const MAX_UPLOAD_EDGE = 2048;

/** Uzun kenar sinirin ustundeyse orantili hedef boyut; degilse oldugu gibi. */
export function fitWithin(width: number, height: number, max = MAX_UPLOAD_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Tarayici gorseli cozemezse (ornegin HEIC) dosya oldugu gibi doner; sunucu
 * dogrulamasi yine gecerli ve anlasilir hata kodu verir.
 */
export async function toUploadJpeg(file: File, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Seffaf PNG JPEG'de siyaha donmesin.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], "shop.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
