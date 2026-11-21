import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany } } }));

import { CityCoverageService } from "@/services/CityCoverageService";

describe("CityCoverageService", () => {
  beforeEach(() => findMany.mockReset());

  it("sehirleri yazimdan bagimsiz gruplar, en cok dukkani olani once verir", async () => {
    findMany.mockResolvedValue([
      { city: "Ankara", latitude: 40, longitude: 33, image: null },
      { city: "İstanbul", latitude: 41, longitude: 29, image: null },
      { city: " istanbul ", latitude: 41.2, longitude: 29.2, image: "/a.jpg" },
      { city: "İstanbul", latitude: 41.1, longitude: 29.1, image: "/b.jpg" },
    ]);
    const list = await new CityCoverageService().list();
    expect(list.map((c) => [c.name, c.shopCount])).toEqual([
      ["İstanbul", 3],
      ["Ankara", 1],
    ]);
    // Medoid: ortadaki dukkan (41.1, 29.1) — digerlerine uzaklik toplami en kucuk.
    expect(list[0].latitude).toBeCloseTo(41.1);
    expect(list[0].coverImage).toBe("/a.jpg");
  });

  it("noktali/noktasiz I ve aksanli yazimlar tek karttir, slug verir", async () => {
    findMany.mockResolvedValue([
      { city: "Istanbul", latitude: 41, longitude: 29, image: null },
      { city: "İstanbul", latitude: 41.1, longitude: 29.1, image: null },
      { city: "ISTANBUL", latitude: 41.2, longitude: 29.2, image: null },
      { city: "Muğla", latitude: 37, longitude: 28, image: null },
      { city: "Mugla", latitude: 37.1, longitude: 28.1, image: null },
    ]);
    const list = await new CityCoverageService().list();
    expect(list.map((c) => [c.slug, c.shopCount])).toEqual([
      ["istanbul", 3],
      ["mugla", 2],
    ]);
  });

  it("aralik disi koordinat merkezi bozmaz ama dukkan sayilir", async () => {
    findMany.mockResolvedValue([
      { city: "Antalya", latitude: 36.9, longitude: 30.7, image: null },
      { city: "Antalya", latitude: 36.8, longitude: 30714466523043455, image: null },
    ]);
    const [antalya] = await new CityCoverageService().list();
    expect(antalya.shopCount).toBe(2);
    expect(antalya.longitude).toBeCloseTo(30.7);
    expect(antalya.latitude).toBeCloseTo(36.9);
  });

  it("merkez yogun bolgede, yaricap en uzak dukkani kapsar (genis il)", async () => {
    findMany.mockResolvedValue([
      // Antalya: uc dukkan Muratpasa'da, biri Kepez, biri Manavgat, biri Alanya.
      { city: "Antalya", latitude: 36.8891, longitude: 30.6869, image: null },
      { city: "Antalya", latitude: 36.895, longitude: 30.7031, image: null },
      { city: "Antalya", latitude: 36.8863, longitude: 30.7145, image: null },
      { city: "Antalya", latitude: 36.9266, longitude: 30.6714, image: null },
      { city: "Antalya", latitude: 36.7867, longitude: 31.4489, image: null },
      { city: "Antalya", latitude: 36.5482, longitude: 31.9987, image: null },
      // Mugla: Bodrum ve Fethiye, aralari ~170 km.
      { city: "Muğla", latitude: 37.009, longitude: 27.2616, image: null },
      { city: "Muğla", latitude: 36.6229, longitude: 29.1085, image: null },
    ]);
    const list = await new CityCoverageService().list();
    const antalya = list.find((c) => c.name === "Antalya")!;
    // Ortalama (36.82, 31.07) Muratpasa'ya ~33 km'ydi; merkez artik kumenin icinde.
    expect(antalya.longitude).toBeLessThan(30.72);
    expect(antalya.radiusM).toBeGreaterThan(120_000); // Alanya da kapsaniyor
    const mugla = list.find((c) => c.name === "Muğla")!;
    // Merkez bir dukkanin kendisi; yaricap digerini kapsar.
    expect([27.2616, 29.1085]).toContain(mugla.longitude);
    expect(mugla.radiusM).toBeGreaterThan(165_000);
  });

  it("tek dukkanli sehirde yaricap en az 5 km", async () => {
    findMany.mockResolvedValue([{ city: "Ankara", latitude: 39.92, longitude: 32.85, image: null }]);
    const [ankara] = await new CityCoverageService().list();
    expect(ankara.radiusM).toBe(5_000);
  });

  it("yalnizca isletilen dukkanlari sorar ve 10 dk onbellekte tutar", async () => {
    findMany.mockResolvedValue([]);
    const svc = new CityCoverageService();
    await svc.list(0);
    await svc.list(5 * 60 * 1000);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ isActive: true, isTest: false, isPrelaunch: false });
    await svc.list(11 * 60 * 1000);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
