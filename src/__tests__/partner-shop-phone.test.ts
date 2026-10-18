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
 *
 * Istemci Expo: okunan alanlar `mobile-expo/src/lib/types.ts`te (kaynagi
 * `mobile-dto.ts`). Flutter'daki `res.data['...']` taramasinin yerine
 * gecti (2026-10-18). Ham Prisma kaydi donen uclar (ornegin admin mesajlari)
 * ve servis tipleri icin sema ve `src/services` de sunucu sayilir.
 */
describe("mobil istemcinin okudugu alanlar sunucuda geciyor", () => {
  function oku(p: string): string {
    const tam = join(process.cwd(), p);
    if (statSync(tam).isFile()) return readFileSync(tam, "utf-8");
    return readdirSync(tam).map((a) => oku(join(p, a))).join("\n");
  }

  it("Expo yanit tiplerindeki alanlarin hepsi sunucu kodunda var", () => {
    const tipler = stripComments(oku("mobile-expo/src/lib/types.ts"));
    const alanlar = new Set([...tipler.matchAll(/^\s+([a-zA-Z][a-zA-Z0-9]*)\??:/gm)].map((m) => m[1]));
    expect(alanlar.size, "taranacak alan bulunamadi").toBeGreaterThan(50);

    const sunucu = ["src/app/api/mobile", "src/lib/mobile-dto.ts", "src/services", "prisma/schema.prisma"]
      .map(oku)
      .join("\n");

    const eksik = [...alanlar].filter((a) => !new RegExp(`\\b${a}\\b`).test(sunucu));
    expect(
      eksik,
      `istemci bu alanlari okuyor ama sunucu hicbir yerde uretmiyor:\n${eksik.join("\n")}`,
    ).toEqual([]);
  });
});
