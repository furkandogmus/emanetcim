import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchesSearchFilters } from "@/lib/search-filter";
import type { ShopSearchHit } from "@/services/ShopService";
import { SEARCH_ALL_RADIUS_KM } from "@/lib/search-defaults";

/**
 * BIR YER ARAMASI, LISTEYI ADRES YAZIMINA GORE ELEMEZ.
 *
 * Uretimde olculdu (2026-09-01, `/tr/search?q=amsterdam`): sekme "TUM NOKTALAR
 * (100)" yazarken liste 7 kart gosteriyordu. Iki ayri kusur ust uste binmisti:
 *
 *   1. Kutudaki metin AYNI ANDA hem haritanin merkezini tasiyor hem de
 *      "adi/adresi bu metni icersin" diye suzuyordu. Amsterdam'a 51 km'deki
 *      Den Haag noktasi bu yuzden Amsterdam aramasinda gorunmuyordu.
 *   2. Sekme sayaci ham listeyi, liste basligi suzulmus listeyi sayiyordu --
 *      ayni ekranda iki farkli sayi.
 *
 * Ucuncusu sunucudaydi: liste `radiusKm: null` ile cekiliyordu, yani "mesafeye
 * gore sirali ilk 100" -- sonuncusu Amsterdam'a 1.128 km uzaktaki Stockholm.
 */

function hit(over: Partial<ShopSearchHit>): ShopSearchHit {
  return {
    id: "s1",
    name: "Dam — Bagageopslag",
    address: "Dam 1, 1012 Amsterdam",
    rating: 4,
    pricePerDay: 100,
    open247: true,
    hasRestroom: true,
    hasCctv: true,
    hasClimateControl: true,
    acceptsLargeItems: true,
    ...over,
  } as ShopSearchHit;
}

const BASE = {
  query: "",
  queryKind: "text" as const,
  minRating: 0,
  maxPrice: 500,
  open247Only: false,
  hasRestroom: false,
  hasCctv: false,
  hasClimateControl: false,
  acceptsLargeItems: false,
};

describe("yer sorgusu metin suzgeci olarak kullanilmaz", () => {
  it("cozumlenmis yer aramasi, adresinde sehir adi GECMEYEN noktayi elemez", () => {
    const denHaag = hit({
      id: "dh",
      name: "Den Haag Centraal — Bagageopslag",
      address: "Koningin Julianaplein 10, 2595 Den Haag",
    });
    expect(
      matchesSearchFilters(denHaag, { ...BASE, query: "amsterdam", queryKind: "place" }),
      "merkez zaten Amsterdam'a tasindi; 51 km oteki nokta listede kalmali",
    ).toBe(true);
  });

  it("geocode beklenirken de elenmez -- liste once daralip sonra genislemez", () => {
    const denHaag = hit({ id: "dh", name: "Den Haag Centraal", address: "Den Haag" });
    expect(
      matchesSearchFilters(denHaag, { ...BASE, query: "amsterdam", queryKind: "pending" }),
    ).toBe(true);
  });

  it("bir yere cozulemeyen metin HALA dukkan adi suzgeci", () => {
    const dam = hit({});
    expect(matchesSearchFilters(dam, { ...BASE, query: "dam", queryKind: "text" })).toBe(true);
    expect(
      matchesSearchFilters(dam, { ...BASE, query: "emanetci baba", queryKind: "text" }),
    ).toBe(false);
  });

  it("olanak suzgecleri yer aramasinda da calisir", () => {
    const noWc = hit({ hasRestroom: false });
    expect(
      matchesSearchFilters(noWc, {
        ...BASE,
        query: "amsterdam",
        queryKind: "place",
        hasRestroom: true,
      }),
    ).toBe(false);
  });
});

describe('"tum noktalar" listesi sinirsiz cekilmez', () => {
  /*
    Statik okuma, cunku olculen sey bir SINIR: `radiusKm: null` derleme
    hatasi vermez, yalnizca listeye baska ulkeleri doldurur.
  */
  const files = [
    "src/app/[locale]/search/page.tsx",
    "src/actions/search-shops.ts",
  ];

  it.each(files)("%s icinde radiusKm: null YOK", (rel) => {
    const src = readFileSync(join(process.cwd(), rel), "utf-8");
    expect(src).not.toMatch(/radiusKm:\s*null/);
    expect(src).toContain("SEARCH_ALL_RADIUS_KM");
  });

  it("tavan, yakindaki yaricapindan buyuk ama ulke asmayacak kadar dar", () => {
    expect(SEARCH_ALL_RADIUS_KM).toBeGreaterThan(10);
    expect(SEARCH_ALL_RADIUS_KM).toBeLessThan(500);
  });
});

describe("sekme sayaci listedeki kart sayisini soyler", () => {
  it("sekme basliklari ham liste uzunlugunu yazmaz", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/guest/SearchClient.tsx"),
      "utf-8",
    );
    /*
      Uretimdeki hali: `{t("allShops")} ({allList.length})`. Sekmedeki sayi,
      o sekmeye basinca kac kart cikacagini soylemek zorunda.
    */
    expect(src).not.toMatch(/t\("allShops"\)\}\s*\(\{allList\.length\}\)/);
    expect(src).not.toMatch(/t\("nearbyShops"\)\}\s*\(\{nearbyList\.length\}\)/);
  });
});

describe("otomatik konum, aranan yeri ezmez", () => {
  /*
    Uretimde goruldu (2026-09-01): `/tr/search?q=amsterdam` acildiginda liste
    bir sure sonra kendiliginden LONDRA noktalarina donuyordu. Geocode merkezi
    Amsterdam'a tasiyor, sayfa acilisinda baslatilan otomatik konum istegi ise
    cevabi ne zaman gelirse merkezi ziyaretcinin konumuna cekiyordu -- gec
    gelen kazaniyordu.

    Yaris bir React efektinde oldugu icin olculen sey KAPININ VARLIGI: konum
    cevabi uygulanmadan once "kullanici bir yer aradi mi" diye bakiliyor mu.
  */
  const src = readFileSync(
    join(process.cwd(), "src/components/guest/SearchClient.tsx"),
    "utf-8",
  );

  it("konum cevabi uygulanmadan once aranan yer kontrol ediliyor", () => {
    expect(src).toMatch(/if \(cancelled \|\| placeSearchedRef\.current\) return;/);
  });

  it("geocode basarili oldugunda bayrak KALDIRILIYOR", () => {
    // Iki dal: geocode servisi ve bilinen sehir yedegi. Ikisi de isaretlemeli.
    const isaret = src.match(/placeSearchedRef\.current = true;/g) ?? [];
    expect(isaret.length).toBeGreaterThanOrEqual(2);
  });

  it('"konumumu bul" dugmesi bu kapidan etkilenmiyor', () => {
    // Kullanici konumu BILEREK istedi; orada bayrak sorgulanmamali.
    const handler = src.slice(src.indexOf("const handleUseMyLocation"));
    const govde = handler.slice(0, handler.indexOf("};"));
    expect(govde).toContain("setDynamicCenter(point)");
    expect(govde).not.toContain("placeSearchedRef");
  });
});
