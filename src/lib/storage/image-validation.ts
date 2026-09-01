/**
 * Yüklenen görselin GERÇEKTEN görsel olduğunun doğrulanması — saf hesap.
 *
 * NEDEN İSTEMCİNİN SÖYLEDİĞİNE GÜVENİLMİYOR: `Content-Type` ve dosya adı
 * tamamen istemci kontrolündedir. `evil.html` dosyasını `image/jpeg` diye
 * göndermek bir satırlık iş; nesne S3'e o tiple yazılırsa tarayıcı onu
 * indirdiğinde ne olacağını saldırgan seçmiş olur. Tür, dosyanın İLK
 * BAYTLARINDAN okunuyor.
 *
 * SVG BİLEREK DIŞARIDA: geçerli bir SVG `<script>` taşıyabilir ve aynı köken
 * altından servis edilirse çalışır. Vitrin fotoğrafı için SVG'ye ihtiyaç yok;
 * bir formatı desteklememek, onu güvenli hâle getirmeye çalışmaktan ucuzdur.
 */

export type ImageKind = "jpeg" | "png" | "webp";

export const IMAGE_CONTENT_TYPE: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const IMAGE_EXTENSION: Record<ImageKind, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/** Dükkan vitrin fotoğrafı üst sınırı. Telefon kamerası tipik olarak 2-5 MB. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * İlk baytlardan gerçek türü okur. Tanımadığı her şey `null`.
 *
 * İmzalar: JPEG `FF D8 FF`; PNG 8 baytlık sabit imza; WebP `RIFF....WEBP`
 * (4-8 arası baytlar dosya boyutudur, o yüzden atlanıyor).
 */
export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((b, i) => bytes[i] === b)) return "png";

  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";

  return null;
}

export type ImageValidationResult =
  | { ok: true; kind: ImageKind; contentType: string; extension: string }
  | { ok: false; reason: "empty" | "too_large" | "unsupported_type" };

/**
 * Boyut ve tür doğrulaması. Sıra ÖNEMLİ: boyut önce bakılır, çünkü çok büyük
 * bir gövdeyi ayrıştırmaya çalışmak zaten istenmeyen iştir.
 */
export function validateImageBytes(bytes: Uint8Array): ImageValidationResult {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };

  const kind = sniffImageKind(bytes);
  if (!kind) return { ok: false, reason: "unsupported_type" };

  return {
    ok: true,
    kind,
    contentType: IMAGE_CONTENT_TYPE[kind],
    extension: IMAGE_EXTENSION[kind],
  };
}

/**
 * Nesne anahtarı. Hiçbir parçası KULLANICI METNİNDEN gelmiyor.
 *
 * Dosya adını anahtara koymak yol geçişi (`../`), çakışma ve kodlama sorunları
 * açar; kimlik zaten `id` ile taşınıyor, adın saklanmasına gerek yok.
 */
export function buildObjectKey(params: {
  prefix: string;
  ownerId: string;
  uniqueId: string;
  extension: string;
}): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safe(params.prefix)}/${safe(params.ownerId)}/${safe(params.uniqueId)}.${safe(params.extension)}`;
}
