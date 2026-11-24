/** Uzun kenar 1600 px, JPEG 0.7. Canvas'a cizmek EXIF/GPS'i de atar (sunucu yine temizler). */
export const BAG_PHOTO_LONG_EDGE_PX = 1600;
export const BAG_PHOTO_JPEG_QUALITY = 0.7;

export function scaledSize(width: number, height: number, longEdge = BAG_PHOTO_LONG_EDGE_PX) {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Tarayicinin cozebildigi her bicimi (iOS Safari'de HEIC dahil) JPEG'e cevirir.
 * `createImageBitmap` EXIF yonunu uygular, yani dik cekilen kare dik kalir.
 */
export async function compressToJpeg(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode_failed"))), "image/jpeg", BAG_PHOTO_JPEG_QUALITY),
    );
  } finally {
    bitmap.close();
  }
}
