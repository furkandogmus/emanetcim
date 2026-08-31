import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * TEST DUKKANI KAMUYA HIC GORUNMEZ; TALEP TESTI NOKTASI REZERVASYON ALMAZ.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `src/lib/public-shop-filter.ts` iki kurali
 * tek yerde tanimliyor ve gerekcesini yaziyor:
 *
 *     "misafire gosterilsin mi?"  -> PUBLIC_SHOP_FILTER   (prelaunch DAHIL)
 *     "burada is yapiliyor mu?"   -> OPERATING_SHOP_FILTER (prelaunch HARIC)
 *
 * Ama KIMLIKLE TEK dukkan okuyan yollarin HICBIRI onu kullanmiyordu -- hepsi
 * filtresiz `getShopDetails` cagiriyor ya da elle `isActive` bakiyordu:
 *
 *   - dukkan sayfasinin `generateMetadata`si: test dukkaninin ADI ve ADRESI,
 *     govdesi 404 donen bir sayfanin `<title>` ve Open Graph alanlarinda
 *   - checkout sayfasi (metadata + govde)
 *   - `/api/mobile/shops/[id]`: kimliksiz mobil detay ucu
 *   - `createBookingAction` ve `/api/mobile/checkout/intent`: PARA YOLU --
 *     test dukkanina rezervasyon yapilabiliyordu, ve isletilmeyen bir talep
 *     testi noktasina da: o noktalarda slot hic uretilmedigi icin misafir,
 *     arkasinda hicbir kapasite olmayan bir yere odeme yapmis olurdu
 *
 * `public-shop-filter.ts` bunu kelimesi kelimesine ongormustu: "yeni bir cagri
 * yeri eklendiginde biri unutulurdu". Bes cagri yeri eklenmis, besi de
 * unutulmustu -- yani filtreyi tek yere almak, onu KULLANDIRMIYORSA yetmiyor.
 */

const ROOT = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Misafire donen yollar: filtresiz `getShopDetails` cagiramaz. */
const GUEST_FACING = [
  "src/app/[locale]/shop/[shopId]/page.tsx",
  "src/app/[locale]/checkout/[shopId]/page.tsx",
  "src/app/api/mobile/shops/[id]/route.ts",
];

/** Rezervasyon acan yollar: `isTest` ve `isPrelaunch` disarida kalmali. */
const BOOKING_PATHS = [
  "src/actions/booking.ts",
  "src/app/api/mobile/checkout/intent/route.ts",
];

describe("dukkan gorunurluk filtresi cagri yerlerinde uygulaniyor", () => {
  it.each(GUEST_FACING)("%s filtresiz `getShopDetails` cagirmiyor", (rel) => {
    const src = stripComments(read(rel));
    expect(
      src.includes("getShopDetails("),
      `${rel} misafire donen bir yol. \`getShopDetails\` FILTRESIZ okur ` +
        `(\`isTest\`/\`isActive\` kontrolu yok). Gosterim icin ` +
        `\`getPublicShopById\`, rezervasyon icin \`getOperatingShopById\` ` +
        `kullanin.`,
    ).toBe(false);
  });

  it.each(BOOKING_PATHS)("%s test ve prelaunch dukkanini reddediyor", (rel) => {
    const src = stripComments(read(rel));
    expect(src, `${rel} \`isTest\` kontrolu tasimali`).toMatch(/isTest/);
    expect(src, `${rel} \`isPrelaunch\` kontrolu tasimali`).toMatch(/isPrelaunch/);
  });

  it("servis iki filtreli erisimciyi de sunuyor", () => {
    const svc = read("src/services/ShopService.ts");
    expect(svc).toMatch(/getPublicShopById[\s\S]{0,200}PUBLIC_SHOP_FILTER/);
    expect(svc).toMatch(/getOperatingShopById[\s\S]{0,200}OPERATING_SHOP_FILTER/);
  });

  it("`getShopDetails` filtresiz oldugunu SOYLUYOR", () => {
    /*
      Fonksiyon hala gerekli (yonetim yollari filtresiz okumali) ama adi bunu
      soylemiyor. En azindan belgesi soylemeli, yoksa bir sonraki cagiran ayni
      varsayimla kullanir -- bes kez oldugu gibi.
    */
    const svc = read("src/services/ShopService.ts");
    const fn = svc.match(/\/\*\*[\s\S]{0,600}?\*\/\s*async getShopDetails/);
    expect(fn, "getShopDetails belgesiz").not.toBeNull();
    expect(fn![0]).toMatch(/FILTRESIZ/);
  });
});
