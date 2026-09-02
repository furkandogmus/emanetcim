import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * ESNAFIN TELEFONU AYARLAR EKRANINDA GORUNUYOR.
 *
 * Olculdu (2026-09-02, gercek veritabani): mobil esnaf ayarlar ekrani
 * `GET /partner/shop` yanitindan telefonu okuyor --
 *
 *     res.data['phone'] ?? res.data['phoneNumber'] ?? ''
 *
 * ...ama yanit `...shop` yayilimindan olusuyordu ve `Shop` modelinde `phone`
 * alani YOK: telefon dukkanin degil, SAHIBIN alani (`User.phone`). Kayitli
 * telefon `+905004445566` iken istemcinin gordugu deger BOS'tu.
 *
 * Yazma yolu ayri bir ucta (`PUT /partner/phone`) ve calisiyordu; yani esnaf
 * telefonunu yazabiliyor ama okuyamiyordu. Silme riski yoktu -- istemci bos
 * alani gondermiyor.
 */

const uc = stripComments(
  readFileSync(join(process.cwd(), "src/app/api/mobile/partner/shop/route.ts"), "utf-8"),
);

describe("partner/shop yaniti", () => {
  it("telefonu SAHIPTEN okuyup donduruyor", () => {
    expect(uc).toMatch(/phone:\s*owner\?\.phone/);
    expect(uc).toMatch(/user\.findUnique/);
  });

  it("`Shop` modelinde phone alani gercekten YOK -- duzeltmenin dayanagi bu", () => {
    /*
      Bu test dusuyorsa `Shop`a bir `phone` alani eklenmis demektir; o zaman
      hangisinin dogru kaynak oldugu yeniden kararlastirilmali, yoksa iki ayri
      telefon birbirinden habersiz yasar.
    */
    const sema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf-8");
    const model = sema.slice(sema.indexOf("model Shop {"), sema.indexOf("model Booking {"));
    expect(model).not.toMatch(/^\s+phone\s+String/m);
  });
});

/**
 * Istemcinin okudugu her alanin sunucuda bir karsiligi olmali. Bu tarama
 * yalnizca ADI gecen alanlari arar -- tip uyumunu olcmez -- ama "istemci
 * okuyor, sunucu hic gondermiyor" sinifini yakalar. Kupon (ayni gun) ve
 * telefon, ikisi de bu sinifti.
 */
describe("mobil istemcinin okudugu alanlar sunucuda geciyor", () => {
  function dartDosyalari(dir: string, out: string[] = []): string[] {
    for (const ad of readdirSync(dir)) {
      const tam = join(dir, ad);
      if (statSync(tam).isDirectory()) dartDosyalari(tam, out);
      else if (ad.endsWith(".dart")) out.push(tam);
    }
    return out;
  }

  it("`res.data['...']` alanlarinin hepsi sunucu kodunda var", () => {
    const mobilKok = join(process.cwd(), "mobile/lib");
    const alanlar = new Set<string>();
    for (const f of dartDosyalari(mobilKok)) {
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(/res\.data\['([a-zA-Z][a-zA-Z0-9]*)'\]/g)) {
        alanlar.add(m[1]);
      }
    }
    expect(alanlar.size, "taranacak alan bulunamadi").toBeGreaterThan(5);

    const sunucu = ["src/app/api/mobile", "src/lib/mobile-dto.ts"]
      .map((p) => {
        const tam = join(process.cwd(), p);
        if (statSync(tam).isFile()) return readFileSync(tam, "utf-8");
        const gez = (d: string): string => readdirSync(d).map((a) => {
          const t = join(d, a);
          return statSync(t).isDirectory() ? gez(t) : readFileSync(t, "utf-8");
        }).join("\n");
        return gez(tam);
      })
      .join("\n");

    const eksik = [...alanlar].filter((a) => !sunucu.includes(a));
    expect(
      eksik,
      `istemci bu alanlari okuyor ama sunucu hicbir yerde uretmiyor:\n${eksik.join("\n")}`,
    ).toEqual([]);
  });
});
