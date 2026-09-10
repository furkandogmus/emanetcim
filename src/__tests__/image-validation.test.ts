import { describe, it, expect } from "vitest";
import {
  sniffImageKind,
  validateImageBytes,
  buildObjectKey,
  readImageDimensions,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION_PX,
} from "@/lib/storage/image-validation";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/*
  ASAGIDAKI UC FIXTURE GERCEK BOYUT HEADER'I TASIR -- `validateImageBytes`e
  piksel-boyutu dogrulamasi eklendikten sonra (2026-09-10) sahte/eksik
  header'lar "dimensions_too_large" ile reddediliyor (dims okunamiyor).
  Byte diziligi, `sharp` ile uretilmis gercek dosyalar karsi elle dogrulandi.
*/

/** 200x100, tek bilesenli minimal SOF0 segmenti. */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x01, 0x01, 0x11, 0x00,
]);
/** 300x150 IHDR. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x01, 0x2c, 0x00, 0x00, 0x00, 0x96,
]);
/** 400x250, VP8X (genisletilmis) konteyner. */
const WEBP = new Uint8Array([
  ...ascii("RIFF"), 0x00, 0x00, 0x00, 0x00, ...ascii("WEBP"), ...ascii("VP8X"),
  0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x8f, 0x01, 0x00, 0xf9, 0x00, 0x00,
]);

/**
 * Tür İSTEMCİNİN BEYANINDAN değil, dosyanın ilk baytlarından okunur.
 * `Content-Type` ve dosya adı tamamen istemci kontrolündedir.
 */
describe("görsel türü tespiti", () => {
  it("JPEG / PNG / WebP imzalarını tanır", () => {
    expect(sniffImageKind(JPEG)).toBe("jpeg");
    expect(sniffImageKind(PNG)).toBe("png");
    expect(sniffImageKind(WEBP)).toBe("webp");
  });

  it("HTML'i görsel SAYMAZ — `image/jpeg` diye gönderilse bile", () => {
    /*
      Asil saldiri yuzeyi bu: `evil.html`i `image/jpeg` diye gondermek bir
      satirlik is. Nesne S3'e o tiple yazilirsa, tarayici onu indirdiginde ne
      olacagini saldirgan secmis olur.
    */
    expect(sniffImageKind(new Uint8Array(ascii("<html><script>alert(1)</script>")))).toBeNull();
  });

  it("SVG'yi BİLEREK kabul etmez", () => {
    // Gecerli bir SVG `<script>` tasiyabilir ve ayni koken altindan servis
    // edilirse calisir. Vitrin fotografi icin SVG'ye ihtiyac yok.
    expect(sniffImageKind(new Uint8Array(ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
  });

  it("kısa / boş girdide tür uydurmaz", () => {
    expect(sniffImageKind(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageKind(new Uint8Array(0))).toBeNull();
  });

  it("RIFF ama WEBP olmayan dosyayı reddeder", () => {
    // RIFF konteyneri WAV/AVI de olabilir; yalnizca ilk dort bayta bakmak yetmez.
    const wav = new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE"), 0, 0, 0, 0]);
    expect(sniffImageKind(wav)).toBeNull();
  });
});

describe("görsel doğrulama", () => {
  it("geçerli görselde tür ve uzantıyı SUNUCUDA belirler", () => {
    expect(validateImageBytes(JPEG)).toEqual({
      ok: true, kind: "jpeg", contentType: "image/jpeg", extension: "jpg",
    });
  });

  it("boş ve çok büyük dosyayı ayrı sebeplerle reddeder", () => {
    expect(validateImageBytes(new Uint8Array(0))).toEqual({ ok: false, reason: "empty" });
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set(JPEG.slice(0, 4));
    expect(validateImageBytes(huge)).toEqual({ ok: false, reason: "too_large" });
  });

  it("sınırın TAM üstündeki dosyayı geçirir", () => {
    const atLimit = new Uint8Array(MAX_IMAGE_BYTES);
    atLimit.set(JPEG);
    expect(validateImageBytes(atLimit).ok).toBe(true);
  });

  it("boyut kontrolü TÜRDEN ÖNCE yapılır", () => {
    // Cok buyuk bir govdeyi ayristirmaya calismak zaten istenmeyen istir.
    const hugeNonImage = new Uint8Array(MAX_IMAGE_BYTES + 1);
    expect(validateImageBytes(hugeNonImage)).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("piksel boyutu doğrulaması (decompression bomb önleme)", () => {
  it("JPEG/PNG/WebP header'ından gerçek genişlik×yükseklik okur", () => {
    expect(readImageDimensions(JPEG, "jpeg")).toEqual({ width: 200, height: 100 });
    expect(readImageDimensions(PNG, "png")).toEqual({ width: 300, height: 150 });
    expect(readImageDimensions(WEBP, "webp")).toEqual({ width: 400, height: 250 });
  });

  it("makul boyuttaki görseli kabul eder", () => {
    expect(validateImageBytes(JPEG)).toMatchObject({ ok: true });
    expect(validateImageBytes(PNG)).toMatchObject({ ok: true });
    expect(validateImageBytes(WEBP)).toMatchObject({ ok: true });
  });

  it("küçük dosya boyutuna karşılık devasa piksel sayısı taşıyan bir görseli reddeder", () => {
    /*
      "Decompression bomb": duz renkli 8000x8000 bir PNG birkaç yuz KB'a
      sikisabilir (sharp ile uretilip dogrulandi) ama decode edilince 192MB
      ciplak piksel verisi -- 2026-09-10'da bulundu.
      Genislik=8000 (0x00001F40), yukseklik=8000 (0x00001F40).
    */
    const bomb = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x1f, 0x40, 0x00, 0x00, 0x1f, 0x40,
    ]);
    expect(validateImageBytes(bomb)).toEqual({ ok: false, reason: "dimensions_too_large" });
  });

  it("tek kenarı sınırın üstünde olan görseli reddeder", () => {
    const tooWide = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ]);
    const view = new DataView(tooWide.buffer);
    view.setUint32(16, MAX_IMAGE_DIMENSION_PX + 1);
    expect(validateImageBytes(tooWide)).toEqual({ ok: false, reason: "dimensions_too_large" });
  });

  it("header'dan boyut okunamayan (bozuk/eksik) bir dosyayı da reddeder", () => {
    const brokenJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(validateImageBytes(brokenJpeg)).toEqual({ ok: false, reason: "dimensions_too_large" });
  });
});

describe("nesne anahtarı", () => {
  it("beklenen biçimi üretir", () => {
    expect(buildObjectKey({ prefix: "shops", ownerId: "s1", uniqueId: "u1", extension: "jpg" }))
      .toBe("shops/s1/u1.jpg");
  });

  it("YOL GEÇİŞİ denemesini temizler", () => {
    /*
      Anahtarin hicbir parcasi kullanici metninden gelmiyor ama savunma yine de
      burada: `../` kabul edilirse kovada baska bir onekin uzerine yazilabilir.
    */
    const key = buildObjectKey({
      prefix: "shops", ownerId: "../../etc", uniqueId: "a/b", extension: "jpg",
    });
    expect(key).not.toContain("..");
    expect(key).toBe("shops/etc/ab.jpg");
  });
});
