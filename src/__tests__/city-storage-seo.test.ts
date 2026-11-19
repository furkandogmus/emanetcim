import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";

vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), info: vi.fn() } }));
const { shopFindMany } = vi.hoisted(() => ({ shopFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany: shopFindMany } } }));
vi.mock("@/lib/shop-distance-postgis", () => ({
  getActiveShopsOrderedByDistanceKm: vi.fn(),
}));

import {
  INDEXED_STORAGE_CITIES,
  isStorageCityIndexed,
  storageCitiesListingShop,
  STORAGE_CITIES,
} from "@/lib/storage-cities";
import { retiredLocaleRedirectPath, RETIRED_LOCALES } from "@/lib/retired-locales";
import { APP_LOCALES } from "@/i18n/locales";
import { getActiveShopsOrderedByDistanceKm } from "@/lib/shop-distance-postgis";
import { getCityStoragePoints } from "@/lib/city-storage-points";

/**
 * ŞEHİR SAYFALARININ ARAMA MOTORUNA GÖRÜNÜMÜ (2026-09-13).
 *
 * Search Console, 6 Haz–10 Eyl: Türkiye'deki altı şehir sayfası 354 tıklama,
 * yurtdışındaki altı şehir 5.143 gösterimde 5 tıklama. Kural ülkeye bağlı,
 * dükkan sayısına değil — gerekçe `isStorageCityIndexed` üzerinde.
 */
describe("sehir sayfasi dizin kurali", () => {
  it("Turkiye sehirleri dizinde, yurtdisi degil", () => {
    expect(INDEXED_STORAGE_CITIES.map((c) => c.slug).sort()).toEqual(
      ["ankara", "antalya", "bodrum", "cappadocia", "fethiye", "istanbul", "izmir"],
    );
    for (const city of STORAGE_CITIES) {
      expect(isStorageCityIndexed(city)).toBe(city.country === "TR");
    }
  });

  it("site haritasi yalnizca dizine acik sehirleri bildirir", () => {
    const src = fs.readFileSync("src/app/sitemap.ts", "utf8");
    expect(src).toContain("INDEXED_STORAGE_CITIES");
    expect(src).not.toMatch(/of STORAGE_CITIES\b/);
  });

  it("sehir sayfasi dizin disi sehri noindex, follow yapar", () => {
    const src = fs.readFileSync("src/app/[locale]/luggage-storage/[slug]/page.tsx", "utf8");
    expect(src).toContain("isStorageCityIndexed(city)");
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
  });

  it("yapisal veri listeleri dizin disi sehri saymaz", () => {
    for (const file of ["src/app/[locale]/page.tsx", "src/app/[locale]/luggage-storage/page.tsx"]) {
      const src = fs.readFileSync(file, "utf8");
      expect(src, file).toContain("items: INDEXED_STORAGE_CITIES.map");
    }
  });
});

describe("kaldirilan dil yonlendirmesi", () => {
  it("eski dil onekini /en karsiligina cevirir", () => {
    expect(retiredLocaleRedirectPath("/ko/luggage-storage/berlin")).toBe("/en/luggage-storage/berlin");
    expect(retiredLocaleRedirectPath("/ru")).toBe("/en");
    expect(retiredLocaleRedirectPath("/es/blog/istanbul-valiz-emanet-rehberi")).toBe(
      "/en/blog/istanbul-valiz-emanet-rehberi",
    );
  });

  it("yasayan dillere ve benzer yollara dokunmaz", () => {
    for (const loc of APP_LOCALES) {
      expect(retiredLocaleRedirectPath(`/${loc}/luggage-storage/bodrum`)).toBeNull();
    }
    expect(retiredLocaleRedirectPath("/koala")).toBeNull();
    expect(retiredLocaleRedirectPath("/tr/ko/luggage-storage/berlin")).toBeNull();
  });

  it("kaldirilan dil listesi yasayan dillerle kesismez", () => {
    const live = new Set<string>(APP_LOCALES);
    expect(RETIRED_LOCALES.filter((l) => live.has(l))).toEqual([]);
  });
});

describe("sehir sayfasi nokta listesi", () => {
  const bodrum = STORAGE_CITIES.find((c) => c.slug === "bodrum")!;
  const row = (id: string, isPrelaunch: boolean, distanceKm: number) => ({
    shop: { id, name: id, district: null, isPrelaunch },
    distanceKm,
  });

  it("rezervasyona acik noktalar once, mesafe sirasi korunur", async () => {
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockResolvedValueOnce(
      [row("yakin-yakinda", true, 1), row("uzak-acik", false, 9), row("orta-yakinda", true, 4)] as never,
    );
    const points = await getCityStoragePoints(bodrum);
    expect(points.map((p) => p.id)).toEqual(["uzak-acik", "yakin-yakinda", "orta-yakinda"]);
    expect(getActiveShopsOrderedByDistanceKm).toHaveBeenCalledWith(
      expect.objectContaining({ radiusKm: bodrum.pointsRadiusKm }),
    );
  });

  it("il sayfasi, yaricap disindaki ayni ildeki isleyen dukkani da listeler", async () => {
    // Prod 2026-11-19: Alanya ve Manavgat esnafi Antalya'nin 25 km'si disindaydi.
    const antalya = STORAGE_CITIES.find((c) => c.slug === "antalya")!;
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockResolvedValueOnce(
      [row("muratpasa", false, 2), row("yakinda", true, 3)] as never,
    );
    shopFindMany.mockResolvedValueOnce([
      { id: "muratpasa", name: "m", district: null, isPrelaunch: false, city: "Antalya", latitude: 36.89, longitude: 30.71 },
      { id: "alanya", name: "a", district: "Alanya", isPrelaunch: false, city: "antalya ", latitude: 36.55, longitude: 32.0 },
      { id: "manavgat", name: "g", district: "Manavgat", isPrelaunch: false, city: "Antalya", latitude: 36.79, longitude: 31.45 },
      { id: "mugla", name: "x", district: null, isPrelaunch: false, city: "Muğla", latitude: 37.0, longitude: 27.4 },
    ]);
    const points = await getCityStoragePoints(antalya);
    expect(points.map((p) => p.id)).toEqual(["muratpasa", "manavgat", "alanya", "yakinda"]);
  });

  it("ilce sayfasi il eslesmesi yapmaz", async () => {
    shopFindMany.mockClear();
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockResolvedValueOnce([] as never);
    await getCityStoragePoints(bodrum);
    expect(shopFindMany).not.toHaveBeenCalled();
  });

  it("veritabani yoksa sayfayi dusurmez, bos liste doner", async () => {
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockRejectedValueOnce(new Error("no db"));
    await expect(getCityStoragePoints(bodrum)).resolves.toEqual([]);
  });
});

describe("storageCitiesListingShop (admin gorunurluk sutunu)", () => {
  const shop = (city: string | null, latitude: number | null, longitude: number | null, isPrelaunch = false) => ({
    city, latitude, longitude, isPrelaunch,
  });

  it("yaricap icindeki ve ayni ildeki dukkani il sayfasina baglar", () => {
    expect(storageCitiesListingShop(shop("Antalya", 36.89, 30.71))).toEqual(["antalya"]);
    expect(storageCitiesListingShop(shop("Antalya", 36.55, 32.0))).toEqual(["antalya"]);
  });

  it("il eslesmesi talep testi noktasina uygulanmaz; konumsuz dukkan hicbir sayfada yok", () => {
    expect(storageCitiesListingShop(shop("Antalya", 36.55, 32.0, true))).toEqual([]);
    expect(storageCitiesListingShop(shop("Antalya", null, null))).toEqual([]);
  });

  it("sayfasi olmayan ildeki dukkan bos doner", () => {
    expect(storageCitiesListingShop(shop("Eskişehir", 39.77, 30.52))).toEqual([]);
  });
});
