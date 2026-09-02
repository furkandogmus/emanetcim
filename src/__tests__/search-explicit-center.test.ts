import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * URL'DEKI MERKEZ EZILMEZ.
 *
 * Uretimde goruldu (2026-09-02, deploy sonrasi dogrulama):
 *
 *     /tr/search?q=galata&lat=41.0256&lng=28.9741
 *     cozumlenen yer: "Galata, Solea, Lefkosa kazasi, Guney Kibris, Kibris"
 *     Yakindaki (0) · Tum Noktalar (0)
 *
 * Ayni sayfa `?q=` olmadan on bir nokta listeliyordu. Yani veri yerindeydi;
 * geocode acik koordinati ezip merkezi Kibris'a tasimisti.
 *
 * SEHIR SAYFALARI TAM BU BICIMDE BAGLANTI VERIYOR
 * (`/search?q=<sehir>&lat=&lng=`), yani bu yol gunluk kullanimda ve belirsiz
 * her sehir adi ayni riski tasiyor.
 *
 * `?lat=&lng=` ile gelen merkez kullanicinin SECIMIDIR; `q` orada arama metni
 * degil, sayfa basligi ve SEO icin tasiniyor. Kullanici kutuyu degistirirse
 * geocode yine calisir -- o an artik URL'deki secim degil, kisinin yeni
 * istegi soz konusudur.
 *
 * Ayni bosluğun TARAYICI KONUMU yarisi daha once kapatilmisti
 * (`placeSearchedRef`); bu, o duzeltmenin eksik kalan yarisi. Ucuncu kez ayni
 * ders: "kullanicinin sectigi merkez" birden fazla kaynak tarafindan
 * ezilebiliyordu ve her kaynak ayri ayri kapatilmak zorundaydi.
 */

const src = stripComments(
  readFileSync(join(process.cwd(), "src/components/guest/SearchClient.tsx"), "utf-8"),
);

describe("acik merkez korunuyor", () => {
  it("ILK sorgu geocode'a gitmiyor", () => {
    expect(src).toMatch(/if \(hasExplicitCenter && searchQuery === initialSearchQuery\)/);
  });

  it("bu durumda metin suzgeci de calismiyor", () => {
    // Merkez dogru; sorgu bir YER olarak kabul edilir, dukkan adi suzgeci degil.
    const blok = src.slice(src.indexOf("hasExplicitCenter && searchQuery === initialSearchQuery"));
    expect(blok.slice(0, 200)).toContain('setQueryKind("place")');
  });

  it("efekt `hasExplicitCenter` ve `initialSearchQuery`ye BAGLI", () => {
    /*
      Bagimlilik dizisinde olmasalardi React eski degerleri kapatir ve kapi
      sessizce yanlis kararlar verirdi.
    */
    expect(src).toMatch(/\[searchQuery, locale, hasExplicitCenter, initialSearchQuery\]/);
  });

  it("TARAYICI KONUMU yarisi da hala kapali", () => {
    // Ayni merkezi ezen ikinci kaynak; birlikte anlamlilar.
    expect(src).toMatch(/hasExplicitCenter \|\| placeSearchedRef\.current/);
  });
});
