import { describe, it, expect } from "vitest";
import fs from "node:fs";

/**
 * TALEP TESTİ NOKTALARININ ARAMA MOTORUNA GÖRÜNÜMÜ.
 *
 * NEDEN (2026-08-31): talep testi 50 noktadan 482'ye çıkarıldı. Bu, sessizce
 * **2.892 URL** demek (482 × 6 dil) ve hepsi rezervasyon almayan, birbirinin
 * neredeyse aynı "yakında açılıyor" sayfası. Site haritası onları Google'a
 * bildiriyordu; aramadan gelen ziyaretçi aradığını bulamaz, arama motoru da
 * ince içerik görür. Üç gerçek dükkanın tarama bütçesi 482 yer tutucuya
 * bölünüyordu.
 *
 * Aynı sorgu `isTest` kayıtlarını da bildiriyordu — oysa P1-4'ün kuralı
 * "isTest kaydı kamuya HİÇ görünmez". Site haritasından daha kamuya açık bir
 * yer yok.
 */
describe("site haritasi", () => {
  const src = fs.readFileSync("src/app/sitemap.ts", "utf8");

  it("dukkanlari OPERATING filtresiyle secer", () => {
    expect(src).toContain("OPERATING_SHOP_FILTER");
  });

  it("elle `isActive: true` yazmaz", () => {
    // Elle yazilan filtre, `isTest` ve `isPrelaunch`i sessizce iceri alir.
    expect(src).not.toMatch(/where:\s*\{\s*isActive:\s*true\s*\}/);
  });
});

describe("nokta sayfasi", () => {
  const src = fs.readFileSync("src/app/[locale]/shop/[shopId]/page.tsx", "utf8");

  it("prelaunch noktasini DIZINE SOKMAZ ama baglantilari izler", () => {
    expect(src).toContain("shop.isPrelaunch");
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
  });
});

describe("dukkan detay servisi", () => {
  const src = fs.readFileSync("src/services/ShopService.ts", "utf8");

  it("kamuya acik detay PUBLIC filtresini kullanir", () => {
    /**
     * P1-4 duzeltmesi arama, listeler ve istatistikleri kapsamis ama DETAY
     * SAYFASINI atlamisti: test dukkani aramada gorunmuyor, URL'i bilen ise
     * sayfasini aciyordu.
     */
    const fn = src.slice(src.indexOf("async getShopPublicDetail"));
    const body = fn.slice(0, fn.indexOf("async getShopImages"));
    expect(body).toContain("PUBLIC_SHOP_FILTER");
    expect(body).not.toMatch(/where:\s*\{\s*id:\s*shopId,\s*isActive:\s*true\s*\}/);
  });
});
