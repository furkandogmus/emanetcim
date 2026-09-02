import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * KOORDINATSIZ DUKKAN ONAYLANMAZ.
 *
 * Gercek veritabaninda olculdu (2026-09-02):
 *
 *     approveShop -> true, isActive: true, koordinat: null
 *     esnafa giden e-posta: "Basvurunuz Onaylandi! 🎉"
 *     500 km yariyapli aramada: GORUNMUYOR
 *
 * Arama tamamen mesafe uzerinden calisiyor
 * (`getActiveShopsOrderedByDistanceKm`), yani koordinati olmayan dukkan HICBIR
 * aramada cikmaz. Esnaf onaylandigini biliyor, rezervasyon bekliyor ve neden
 * gelmedigini bilmiyor; admin de bir sey yaptigini saniyor cunku islem
 * "basarili" donuyordu. `DEFECT_BACKLOG` bunu D9'da "sessiz bir tuzak" diye
 * isaretlemisti.
 *
 * Koordinat girilmeden verilen onay, tutulamayacak bir sozdur.
 */

const oku = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), "utf-8"));

describe("onay kapisi", () => {
  const servis = oku("src/services/ShopService.ts");

  it("koordinat yoksa onay REDDEDILIYOR", () => {
    expect(servis).toMatch(/shop\.latitude == null \|\| shop\.longitude == null/);
    expect(servis).toContain('reason: "missing_coordinates"');
  });

  it("sonuc YAPILANDIRILMIS -- `boolean` iki farkli sebebi tasiyamaz", () => {
    expect(servis).toMatch(/approveShop\(shopId: string\): Promise<ApproveShopResult>/);
  });
});

/**
 * TRUTHY NESNE TUZAGI.
 *
 * `boolean` -> nesne donusumunde cagiranlar DERLEYICI TARAFINDAN ZORLANMAZ:
 * `if (!ok)` bir nesne icin her zaman `false`tur ve TypeScript bunu uyarmaz.
 * Bu duzeltmede iki cagiran da tam olarak o kalibi kullaniyordu; ikisi de
 * `.ok` okumaya cevrildi. Mandal, kalibin geri gelmesini engelliyor.
 */
describe("cagiranlar sonucu DOGRU okuyor", () => {
  it.each([
    "src/app/api/admin/applications/[id]/[action]/route.ts",
    "src/actions/admin-management.ts",
  ])("%s `.ok` uzerinden kontrol ediyor", (rel) => {
    const src = oku(rel);
    const cagri = src.slice(src.indexOf("shopService.approveShop"));
    const pencere = cagri.slice(0, 400);
    expect(pencere, "sonuc `.ok` ile okunmali").toMatch(/!result\.ok/);
    expect(pencere, "ciplak truthy kontrolu kalmamali").not.toMatch(/if \(!(ok|success)\)/);
  });

  it("sebep kullaniciya AYRI mesajla donuyor", () => {
    const uc = oku("src/app/api/admin/applications/[id]/[action]/route.ts");
    expect(uc).toContain("missing_coordinates");
    // 409: istek gecerli, kaynagin su anki durumu kabul etmiyor.
    expect(uc).toMatch(/status:\s*409/);

    const web = oku("src/actions/admin-management.ts");
    expect(web).toContain("Errors.shopMissingCoordinates");
  });
});
