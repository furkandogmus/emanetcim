import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PUBLIC_SHOP_FILTER,
  PUBLIC_SHOP_SQL_CONDITION,
} from "@/lib/public-shop-filter";

/**
 * Kamuya açık dükkan filtresi.
 *
 * Neden test edilir: bu filtre üç ayrı yerde ayrı ayrı yazılmıştı ve hepsi yalnızca
 * `isActive`'e bakıyordu. Bir test dükkanı bu yüzden canlı aramada gerçek
 * partnerlerin yanında görünüyordu — Türkiye'de bulunabilen üç dükkandan biri
 * kişisel bir test kaydıydı (2026-08-22, P1-4).
 *
 * Filtre artık tek yerde, ama İKİ biçimde: Prisma nesnesi ve ham SQL (PostGIS
 * mesafe sorgusu Prisma `where` kullanamıyor). Bu test ikisinin ayrışmasını yakalar.
 */

describe("PUBLIC_SHOP_FILTER", () => {
  it("aktif ve test olmayan dükkanları seçer", () => {
    expect(PUBLIC_SHOP_FILTER).toEqual({ isActive: true, isTest: false });
  });

  it("SQL karşılığı aynı alanları içerir — iki tanım ayrışamaz", () => {
    for (const field of Object.keys(PUBLIC_SHOP_FILTER)) {
      expect(
        PUBLIC_SHOP_SQL_CONDITION,
        `PUBLIC_SHOP_SQL_CONDITION "${field}" alanını içermiyor — ` +
          `Prisma filtresine alan eklendi ama SQL karşılığı güncellenmedi`,
      ).toContain(`"${field}"`);
    }
  });

  it("SQL koşulu `s` takma adını kullanır — sorgular öyle yazılmış", () => {
    expect(PUBLIC_SHOP_SQL_CONDITION).toMatch(/\bs\./);
  });
});

describe("filtreyi kullanan yüzeyler", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(process.cwd(), rel), "utf8");

  /**
   * Misafire dükkan listeleyen/sayan dosyalar. Yeni bir tane eklenirse buraya da
   * eklenmeli — liste, "unutulan dördüncü yer" hatasının kendisine karşı korumadır.
   */
  const PUBLIC_SURFACES = [
    "src/lib/shop-distance-postgis.ts",
    "src/lib/guest-landing-stats.ts",
  ];

  it.each(PUBLIC_SURFACES)("%s paylaşılan filtreyi kullanıyor", (rel) => {
    const src = read(rel);
    expect(src).toContain("public-shop-filter");
  });

  it.each(PUBLIC_SURFACES)(
    "%s içinde elle yazılmış `isActive: true` kalmamış",
    (rel) => {
      const src = read(rel);
      // Elle yazilmis filtre, paylasilan olani baypas eder ve isTest'i kacirir.
      expect(src).not.toMatch(/where:\s*\{\s*isActive:\s*true\s*\}/);
    },
  );

  it("PostGIS ham sorgusu paylaşılan SQL koşulunu kullanıyor", () => {
    const src = read("src/lib/shop-distance-postgis.ts");
    expect(src).toContain("PUBLIC_SHOP_SQL_CONDITION");
    // Eski elle yazilmis kosul kalmamis olmali.
    expect(src).not.toContain('WHERE s."isActive" = true');
  });
});
