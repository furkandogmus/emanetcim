import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * ISTEMCININ GONDERDIGI ALAN SUNUCUDA YOKSA SESSIZCE ATILIR.
 *
 * `z.object` tanimlanmamis alanlari varsayilan olarak DUSURUR: gonderen taraf
 * 200 alir, degeri kaydedilmez, hicbir yerde uyari kalmaz. Ayni gun iki ornegi
 * bulundu:
 *
 *   - `/checkout/intent` -> `couponCode`: misafir kupon girer, TAM FIYAT oder.
 *   - `/partner/shop`    -> `address`, `city`, `district`: esnaf adresini
 *     duzeltir, "kaydedildi" yanitini alir ve hicbir sey degismez.
 *
 * Ikincisi ozellikle sinsi, cunku adres misafirin dukkani buldugu metin:
 * yanlis kalan bir adres misafiri yanlis kapiya gonderir. Web tarafi
 * (`actions/shop.ts`) uc alani da kabul ediyordu -- kural yine iki tasiyicidan
 * yalnizca birinde vardi.
 */

describe("partner/shop guncelleme alanlari", () => {
  const uc = stripComments(
    readFileSync(join(process.cwd(), "src/app/api/mobile/partner/shop/route.ts"), "utf-8"),
  );

  it.each(["address", "city", "district"])("`%s` semada tanimli", (alan) => {
    expect(uc).toMatch(new RegExp(`${alan}:\\s*z\\.string\\(\\)`));
  });

  it.each(["address", "city", "district"])("`%s` gercekten YAZILIYOR", (alan) => {
    // Semaya eklemek yetmez: `data` nesnesine de gecmeli.
    expect(uc).toMatch(new RegExp(`data\\.${alan} = parsed\\.data\\.${alan}`));
  });

  it("web ile ayni alan kumesi", () => {
    const web = stripComments(
      readFileSync(join(process.cwd(), "src/actions/shop.ts"), "utf-8"),
    );
    for (const alan of ["address", "city", "district"]) {
      expect(web, `web ${alan} kabul ediyor`).toContain(`${alan}:`);
    }
  });
});

/**
 * SINIF TARAMASI: mobil istemcinin `body: { ... }` ile GONDERDIGI her alanin
 * hedef ucta bir karsiligi olmali. Istemci Expo (`mobile-expo/src`); Flutter
 * kaldirildi (2026-10-18), tarama onunla birlikte Expo'ya tasindi.
 *
 * Kardesi `partner-shop-phone.test.ts`te: o OKUMA yonunu tariyor, bu YAZMA yonunu.
 */
describe("mobil istemcinin gonderdigi alanlar sunucuda taniniyor", () => {
  function tsDosyalari(dir: string, out: string[] = []): string[] {
    for (const ad of readdirSync(dir)) {
      const tam = join(dir, ad);
      if (statSync(tam).isDirectory()) {
        if (ad !== "__tests__") tsDosyalari(tam, out);
      } else if (/\.tsx?$/.test(ad)) out.push(tam);
    }
    return out;
  }

  /** `/bookings/${x}/modify` -> `src/app/api/mobile/bookings/[id]/modify/route.ts` */
  function ucDosyasi(uc: string): string | null {
    const yol = uc.replace(/^\//, "").replace(/\$\{[^}]+\}/g, "[id]");
    const aday = join(process.cwd(), "src/app/api/mobile", yol, "route.ts");
    try {
      return statSync(aday).isFile() ? aday : null;
    } catch {
      return null;
    }
  }

  it("gonderilen her alan hedef ucta geciyor", () => {
    const ihlaller: string[] = [];
    let taranan = 0;
    // api<T>("/uc", { method: "POST", body: { a, b: x } }) -- `withShop(...)` sarmali da olur.
    const cagri =
      /api(?:<[^>]*>)?\(\s*(?:withShop\(\s*)?["`]([^"`?]+)[^,]*(?:,\s*[a-zA-Z]+\))?,\s*\{\s*method:\s*"(?:POST|PUT|PATCH)",\s*body:\s*\{([^}]*)\}/g;

    for (const f of tsDosyalari(join(process.cwd(), "mobile-expo/src"))) {
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(cagri)) {
        const hedef = ucDosyasi(m[1]);
        if (!hedef) continue;
        taranan++;
        const ucSrc = stripComments(readFileSync(hedef, "utf-8"));
        const alanlar = m[2]
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x && !x.startsWith("..."))
          .map((x) => x.split(":")[0].trim());
        for (const a of new Set(alanlar)) {
          // KELIME SINIRI SART: duz `includes` `city`yi `capacity` icinde bulurdu.
          if (!new RegExp(`\\b${a}\\b`).test(ucSrc)) ihlaller.push(`${m[1]} -> ${a}`);
        }
      }
    }

    expect(taranan, "eslesen uc bulunamadi -- tarama bozulmus olabilir").toBeGreaterThan(5);
    expect(
      ihlaller,
      `istemci bu alanlari gonderiyor ama uc tanimiyor (zod sessizce atar):\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });
});
