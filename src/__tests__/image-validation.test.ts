import { describe, it, expect } from "vitest";
import {
  sniffImageKind,
  validateImageBytes,
  buildObjectKey,
  MAX_IMAGE_BYTES,
} from "@/lib/storage/image-validation";

const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(16).fill(0)]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const WEBP = new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), 0, 0, 0, 0]);

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
    atLimit.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateImageBytes(atLimit).ok).toBe(true);
  });

  it("boyut kontrolü TÜRDEN ÖNCE yapılır", () => {
    // Cok buyuk bir govdeyi ayristirmaya calismak zaten istenmeyen istir.
    const hugeNonImage = new Uint8Array(MAX_IMAGE_BYTES + 1);
    expect(validateImageBytes(hugeNonImage)).toEqual({ ok: false, reason: "too_large" });
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
