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

/** Bir kenarın piksel üst sınırı. next/image optimizer bunu SUNUCUDA decode eder. */
export const MAX_IMAGE_DIMENSION_PX = 6000;
/** Toplam piksel üst sınırı (genişlik×yükseklik) — tek kenar sınırını geçmeyen ama alanı devasa (ör. 6000×6000) bir görseli de yakalar. */
export const MAX_IMAGE_PIXELS = 24_000_000; // ör. 6000x4000

/**
 * Baytlardan piksel genişlik/yüksekliğini okur (decode ETMEDEN — yalnızca
 * format header'ı ayrıştırılır). `null`: format tanınamadı/bozuk header.
 *
 * NEDEN VAR (2026-09-10'da bulundu): `validateImageBytes` yalnızca BAYT
 * boyutunu (<=8MB) kontrol ediyordu, piksel boyutunu değil. Küçük dosya
 * boyutuna karşılık devasa piksel sayısı taşıyan bir "decompression bomb"
 * (ör. düz renkli 40000x40000 PNG birkaç KB'a sıkışabilir) 8MB sınırını
 * rahatça geçer, ama `next/image` optimizer (sharp) onu SUNUCUDA decode
 * ederken bellekte çıplak piksel verisi kadar yer kaplar — 40000×40000×4
 * bayt ~6GB. Esnaf hesabı olmak admin onayı gerektirmediğinden (bkz.
 * register.ts) bu, kimliklenmiş herhangi bir self-serve hesaptan tek-VM
 * dağıtımı OOM'a düşürme yoludur.
 */
export function readImageDimensions(
  bytes: Uint8Array,
  kind: ImageKind
): { width: number; height: number } | null {
  const u16be = (o: number) => (bytes[o] << 8) | bytes[o + 1];
  const u32be = (o: number) =>
    ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  const u16le = (o: number) => bytes[o] | (bytes[o + 1] << 8);
  const u24le = (o: number) => bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16);
  const u32le = (o: number) =>
    (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;

  if (kind === "png") {
    // İmza (8) + uzunluk (4) + "IHDR" (4): IHDR PNG'de HER ZAMAN ilk chunk.
    if (bytes.length < 24) return null;
    return { width: u32be(16), height: u32be(20) };
  }

  if (kind === "jpeg") {
    // Marker'lar arasinda SOFn (0xC0-0xCF, 0xC4/0xC8/0xCC haric) bulunana
    // kadar gez; her segment kendi uzunlugunu tasir.
    let o = 2;
    let guard = 0;
    while (o + 4 <= bytes.length && guard++ < 200) {
      if (bytes[o] !== 0xff) return null;
      const marker = bytes[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2;
        continue;
      }
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      const segLen = u16be(o + 2);
      if (isSof) {
        if (o + 9 > bytes.length) return null;
        return { height: u16be(o + 5), width: u16be(o + 7) };
      }
      if (marker === 0xda) return null; // Start-of-scan: SOF bulunamadan tarama basladi.
      o += 2 + segLen;
    }
    return null;
  }

  // webp
  if (bytes.length < 30) return null;
  const fourCc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourCc === "VP8X") {
    return { width: u24le(24) + 1, height: u24le(27) + 1 };
  }
  if (fourCc === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const b = u32le(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (fourCc === "VP8 ") {
    // RFC 6386 §9.1: 3 bayt frame tag, ardindan 3 baytlik baslangic kodu
    // (0x9d 0x01 0x2a), ardindan 16'sar bitlik genislik/yukseklik (LE, ust 2
    // bit olcek).
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
  }
  return null;
}

export type ImageValidationResult =
  | { ok: true; kind: ImageKind; contentType: string; extension: string }
  | { ok: false; reason: "empty" | "too_large" | "unsupported_type" | "dimensions_too_large" };

/**
 * Boyut ve tür doğrulaması. Sıra ÖNEMLİ: boyut önce bakılır, çünkü çok büyük
 * bir gövdeyi ayrıştırmaya çalışmak zaten istenmeyen iştir.
 */
export function validateImageBytes(bytes: Uint8Array): ImageValidationResult {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };

  const kind = sniffImageKind(bytes);
  if (!kind) return { ok: false, reason: "unsupported_type" };

  const dims = readImageDimensions(bytes, kind);
  if (
    !dims ||
    dims.width <= 0 ||
    dims.height <= 0 ||
    dims.width > MAX_IMAGE_DIMENSION_PX ||
    dims.height > MAX_IMAGE_DIMENSION_PX ||
    dims.width * dims.height > MAX_IMAGE_PIXELS
  ) {
    return { ok: false, reason: "dimensions_too_large" };
  }

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
