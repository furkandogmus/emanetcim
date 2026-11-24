import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";

const { shopFindMany, blogFindMany, wantCount } = vi.hoisted(() => ({
  shopFindMany: vi.fn(),
  blogFindMany: vi.fn(),
  wantCount: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  default: { shop: { findMany: shopFindMany }, blogPost: { findMany: blogFindMany } },
}));
// Gercek routing next/navigation ceker; site haritasi yalnizca dil listesini okur.
vi.mock("@/i18n/routing", async () => {
  const { APP_LOCALES, DEFAULT_APP_LOCALE } = await import("@/i18n/locales");
  return { routing: { locales: [...APP_LOCALES], defaultLocale: DEFAULT_APP_LOCALE } };
});
vi.mock("@/lib/shop-distance-postgis", () => ({ getActiveShopsOrderedByDistanceKm: vi.fn() }));
vi.mock("@/services/ShopScheduleService", () => ({
  loadScheduleParts: vi.fn(async () => new Map()),
}));
vi.mock("@/services/PrelaunchInterestService", () => ({
  prelaunchInterestService: { wantCount },
}));

import {
  HUB_KIND_RADIUS_KM,
  TRANSIT_HUBS,
  getTransitHub,
  hubPath,
  hubRadiusKm,
  hubsForCity,
} from "@/lib/transit-hubs";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import { distanceKm } from "@/lib/geo";
import { getHubShops, hubsWithOperatingShop, isHubIndexable } from "@/lib/transit-hub-shops";
import { getActiveShopsOrderedByDistanceKm } from "@/lib/shop-distance-postgis";
import { APP_LOCALES } from "@/i18n/locales";
import sitemap from "@/app/sitemap";

const LOCALES = APP_LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(`src/locales/${l}.json`, "utf8"))] as const);

describe("yer verisi", () => {
  it("slug'lar benzersiz, sehir mevcut, tur bilinen", () => {
    const keys = TRANSIT_HUBS.map((h) => `${h.city}/${h.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Slug her dilde ayni URL parcasi: yalnizca ASCII kucuk harf ve tire.
    for (const h of TRANSIT_HUBS) {
      expect(h.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(STORAGE_CITIES.some((c) => c.slug === h.city)).toBe(true);
      expect(Object.keys(HUB_KIND_RADIUS_KM)).toContain(h.kind);
      expect(hubRadiusKm(h)).toBeGreaterThan(0);
    }
  });

  it("istenen Istanbul yerlerinin tamami var", () => {
    expect(hubsForCity("istanbul").map((h) => h.slug).sort()).toEqual(
      [
        "besiktas", "eminonu", "esenler-bus-terminal", "galata", "istanbul-airport", "kadikoy",
        "karakoy", "sabiha-gokcen-airport", "sirkeci", "sogutlucesme", "sultanahmet", "taksim",
      ],
    );
  });

  it("koordinatlar sehrin sayfa yaricapinda ve turuyle tutarli", () => {
    for (const h of TRANSIT_HUBS) {
      const city = STORAGE_CITIES.find((c) => c.slug === h.city)!;
      const fromCenter = distanceKm(city.lat, city.lng, h.lat, h.lng);
      expect(fromCenter, h.slug).toBeLessThanOrEqual(city.pointsRadiusKm);
      // Yer degistirmis enlem/boylam ya da kopyala-yapistir hatasi: havalimani merkezden uzak, semt yakin.
      if (h.kind === "airport") expect(fromCenter, h.slug).toBeGreaterThan(20);
      else expect(fromCenter, h.slug).toBeLessThan(15);
    }
  });

  it("iki yer ayni noktayi gostermiyor", () => {
    for (const a of TRANSIT_HUBS) {
      for (const b of TRANSIT_HUBS) {
        if (a === b) continue;
        expect(distanceKm(a.lat, a.lng, b.lat, b.lng), `${a.slug}~${b.slug}`).toBeGreaterThan(0.3);
      }
    }
  });

  it("her yerin ve her turun metni her dilde var", () => {
    for (const [loc, msgs] of LOCALES) {
      const ns = msgs.TransitHubs;
      for (const h of TRANSIT_HUBS) {
        for (const k of ["name", "near", "intro", "gettingThere"]) {
          expect(ns.hubs[h.slug]?.[k], `${loc} ${h.slug}.${k}`).toBeTruthy();
        }
        for (const k of ["tip1", "tip2", "tip3", "faqQ", "faqA"]) {
          expect(ns.kinds[h.kind]?.[k], `${loc} ${h.kind}.${k}`).toBeTruthy();
        }
      }
    }
  });

  it("URL sehir sayfasinin altinda", () => {
    expect(hubPath(getTransitHub("istanbul", "taksim")!)).toBe("/luggage-storage/istanbul/taksim");
    expect(getTransitHub("ankara", "taksim")).toBeUndefined();
  });
});

const shop = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: id,
  district: null,
  address: null,
  isPrelaunch: false,
  latitude: 41.0,
  longitude: 29.0,
  open247: false,
  openingTime: "09:00",
  closingTime: "20:00",
  timezone: "Europe/Istanbul",
  ...over,
});

describe("ince icerik kapisi (noindex)", () => {
  const taksim = getTransitHub("istanbul", "taksim")!;
  beforeEach(() => vi.mocked(getActiveShopsOrderedByDistanceKm).mockReset());

  it("yaricapta isleyen dukkan varsa liste dolu ve sayfa dizinde", async () => {
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockResolvedValueOnce([
      { shop: shop("yakinda", { isPrelaunch: true }), distanceKm: 0.2 },
      { shop: shop("acik", { open247: true }), distanceKm: 0.8 },
    ] as never);
    const res = await getHubShops(taksim, new Date("2026-11-24T10:00:00Z"));
    expect(getActiveShopsOrderedByDistanceKm).toHaveBeenCalledWith(
      expect.objectContaining({ centerLat: taksim.lat, centerLng: taksim.lng, radiusKm: hubRadiusKm(taksim) }),
    );
    expect(res.shops.map((s) => s.id)).toEqual(["acik"]);
    expect(res.shops[0]).toMatchObject({ openNow: true, distanceKm: 0.8 });
    expect(res.prelaunch).toBeNull();
    expect(isHubIndexable(res)).toBe(true);
  });

  it("acik/kapali durumu dukkanin saatine gore", async () => {
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockResolvedValueOnce([
      { shop: shop("gunduz"), distanceKm: 1 },
    ] as never);
    // 23:00 Istanbul saati
    const res = await getHubShops(taksim, new Date("2026-11-24T20:00:00Z"));
    expect(res.shops[0]).toMatchObject({ openNow: false, todayHours: { open: "09:00", close: "20:00" } });
  });

  it("yalniz talep testi noktasi varsa noindex ve istek formu o noktaya bagli", async () => {
    wantCount.mockResolvedValueOnce(4);
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockResolvedValueOnce([
      { shop: shop("yakinda", { isPrelaunch: true }), distanceKm: 0.5 },
    ] as never);
    const res = await getHubShops(taksim);
    expect(res).toEqual({ shops: [], prelaunch: { id: "yakinda", name: "yakinda", wantCount: 4 } });
    expect(isHubIndexable(res)).toBe(false);
  });

  it("hic nokta yoksa liste ve form bos", async () => {
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockResolvedValueOnce([] as never);
    const res = await getHubShops(taksim);
    expect(res).toEqual({ shops: [], prelaunch: null });
    expect(isHubIndexable(res)).toBe(false);
  });

  it("veritabani hatasi yutulmaz (sahte noindex yerine ISR eski surumu sunar)", async () => {
    vi.mocked(getActiveShopsOrderedByDistanceKm).mockRejectedValueOnce(new Error("db down"));
    await expect(getHubShops(taksim)).rejects.toThrow("db down");
  });

  it("sayfa dizin disi karari isHubIndexable'a bagli", () => {
    const src = fs.readFileSync("src/app/[locale]/luggage-storage/[slug]/[hub]/page.tsx", "utf8");
    expect(src).toContain("isHubIndexable(result)");
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
    expect(src).toContain("PrelaunchDemandPanel");
  });
});

describe("site haritasi", () => {
  const kadikoy = getTransitHub("istanbul", "kadikoy")!;
  const nearKadikoy = { latitude: kadikoy.lat + 0.005, longitude: kadikoy.lng };

  beforeEach(() => {
    shopFindMany.mockReset();
    blogFindMany.mockReset().mockResolvedValue([]);
  });

  it("hubsWithOperatingShop yaricapa gore suzer", () => {
    expect(hubsWithOperatingShop(TRANSIT_HUBS, [nearKadikoy]).map((h) => h.slug)).toEqual([
      // Söğütlüçeşme istasyonu Kadıköy iskelesine ~1,3 km: ayni dukkan ikisini de besler.
      "sogutlucesme",
      "kadikoy",
    ]);
    expect(hubsWithOperatingShop(TRANSIT_HUBS, [])).toEqual([]);
  });

  it("isleyen dukkani olan yer her dilde var, olmayan yok", async () => {
    shopFindMany.mockImplementation(async (args: { select: Record<string, boolean> }) =>
      args.select.latitude ? [nearKadikoy] : [],
    );
    const urls = (await sitemap()).map((e) => e.url);
    for (const loc of APP_LOCALES) {
      expect(urls.some((u) => u.endsWith(`/${loc}/luggage-storage/istanbul/kadikoy`))).toBe(true);
    }
    expect(urls.some((u) => u.includes("/luggage-storage/istanbul/taksim"))).toBe(false);
    expect(urls.some((u) => u.includes("/luggage-storage/istanbul/istanbul-airport"))).toBe(false);
  });

  it("veritabani yoksa yer girdisi yok, site haritasi yine uretilir", async () => {
    shopFindMany.mockRejectedValue(new Error("no db"));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.includes("/luggage-storage/istanbul/kadikoy"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/tr/luggage-storage/istanbul"))).toBe(true);
  });
});
