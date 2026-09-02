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
 * SINIF TARAMASI: mobil istemcinin `data: { ... }` ile GONDERDIGI her alanin
 * hedef ucta bir karsiligi olmali.
 *
 * Kardesi `partner-shop-phone.test.ts`te: o OKUMA yonunu tariyor
 * (`res.data['...']`), bu YAZMA yonunu.
 */
describe("mobil istemcinin gonderdigi alanlar sunucuda taniniyor", () => {
  function dartDosyalari(dir: string, out: string[] = []): string[] {
    for (const ad of readdirSync(dir)) {
      const tam = join(dir, ad);
      if (statSync(tam).isDirectory()) dartDosyalari(tam, out);
      else if (ad.endsWith(".dart")) out.push(tam);
    }
    return out;
  }

  /** `/bookings/${x}/modify` -> `src/app/api/mobile/bookings/[id]/modify/route.ts` */
  function ucDosyasi(uc: string): string | null {
    const yol = uc
      .replace(/^\//, "")
      .replace(/\$\{[^}]+\}/g, "[id]")
      .replace(/\$[a-zA-Z_]+/g, "[id]");
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

    for (const f of dartDosyalari(join(process.cwd(), "mobile/lib"))) {
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(
        /dio\.(?:post|put|patch)\(\s*\n?\s*'([^']+)'\s*,\s*data:\s*\{([\s\S]*?)\}\s*,?\s*\)/g,
      )) {
        const hedef = ucDosyasi(m[1]);
        if (!hedef) continue;
        taranan++;
        const ucSrc = stripComments(readFileSync(hedef, "utf-8"));
        for (const a of new Set([...m[2].matchAll(/'([a-zA-Z][a-zA-Z0-9]*)'\s*:/g)].map((x) => x[1]))) {
          /*
            KELIME SINIRI SART: ilk yazdigim tarama `city`yi "var" saymisti,
            cunku ucta `capacity` gecıyor ve duz `includes` onu yakaliyordu.
            Yanlis negatif, tam da aradigimiz hatayi gizliyordu.
          */
          if (!new RegExp(`\\b${a}\\b`).test(ucSrc)) {
            ihlaller.push(`${m[1]} -> ${a}`);
          }
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
