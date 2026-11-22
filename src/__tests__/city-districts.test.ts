import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany } } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: vi.fn().mockResolvedValue("1.1.1.1") }));

import { CityCoverageService } from "@/services/CityCoverageService";
import { GET } from "@/app/api/mobile/cities/[city]/districts/route";

/**
 * Mobil aramada sehirden sonraki ilce adimi. Elle tutulan ilce tablosu yok: ilceler
 * isletilen dukkanlardan turer. Istemci "Merkez"i kendisi ilk satira koyar; sunucu
 * yalnizca dukkani olan ilceleri, Turkce alfabe sirasiyla verir.
 */
const shop = (city: string, district: string | null, latitude: number, longitude: number) => ({
  city,
  district,
  latitude,
  longitude,
});

describe("CityCoverageService.districts", () => {
  beforeEach(() => findMany.mockReset());

  it("yalnizca isletilen (aktif, test/prelaunch olmayan), ilcesi ve koordinati olan dukkanlari sorar", async () => {
    findMany.mockResolvedValue([]);
    await new CityCoverageService().districts("istanbul");
    const where = findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      isActive: true,
      isTest: false,
      isPrelaunch: false,
      district: { not: null },
      latitude: { not: null },
      longitude: { not: null },
    });
  });

  it("Turkce alfabe sirasi: C < Ç, I (noktasiz) < İ, O < Ö, S < Ş, U < Ü", async () => {
    const names = ["Üsküdar", "Şişli", "Ortaköy", "İçmeler", "Çankaya", "Zeytinburnu", "Ömerli", "Ilıca", "Sarıyer", "Cihangir", "Uzunköprü", "Beşiktaş"];
    findMany.mockResolvedValue(names.map((n, i) => shop("İstanbul", n, 41 + i / 100, 29)));
    const list = await new CityCoverageService().districts("istanbul");
    expect(list.map((d) => d.name)).toEqual([
      "Beşiktaş",
      "Cihangir",
      "Çankaya",
      "Ilıca",
      "İçmeler",
      "Ortaköy",
      "Ömerli",
      "Sarıyer",
      "Şişli",
      "Uzunköprü",
      "Üsküdar",
      "Zeytinburnu",
    ]);
  });

  it("merkez ilcedeki dukkanlarin koordinat ortalamasi", async () => {
    findMany.mockResolvedValue([
      shop("İstanbul", "Kadıköy", 40.98, 29.02),
      shop("İstanbul", "Kadıköy", 41.0, 29.06),
      shop("İstanbul", "Kadıköy", 40.99, 29.04),
      shop("İstanbul", "Beşiktaş", 41.04, 29.0),
    ]);
    const list = await new CityCoverageService().districts("istanbul");
    const kadikoy = list.find((d) => d.slug === "kadikoy")!;
    expect(kadikoy.latitude).toBeCloseTo(40.99, 6);
    expect(kadikoy.longitude).toBeCloseTo(29.04, 6);
    expect(kadikoy.shopCount).toBe(3);
  });

  it("yazim farklari tek ilce; en sik yazilan bicim gosterilir", async () => {
    findMany.mockResolvedValue([
      shop("İstanbul", "Kadıköy", 41, 29),
      shop("Istanbul", " kadikoy ", 41, 29),
      shop("ISTANBUL", "KADIKÖY", 41, 29),
      shop("istanbul", "Kadıköy", 41, 29),
    ]);
    const list = await new CityCoverageService().districts("istanbul");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Kadıköy", slug: "kadikoy", shopCount: 4 });
  });

  it("baska sehrin ilceleri karismaz; bilinmeyen sehir bos liste", async () => {
    findMany.mockResolvedValue([shop("İstanbul", "Kadıköy", 41, 29), shop("Ankara", "Çankaya", 39.9, 32.8)]);
    const svc = new CityCoverageService();
    expect((await svc.districts("ankara")).map((d) => d.name)).toEqual(["Çankaya"]);
    expect(await svc.districts("atlantis")).toEqual([]);
  });

  it("aralik disi koordinat ilce merkezini bozmaz", async () => {
    findMany.mockResolvedValue([
      shop("Antalya", "Muratpaşa", 36.9, 30.7),
      shop("Antalya", "Muratpaşa", 36.8, 30714466523043455),
    ]);
    const [d] = await new CityCoverageService().districts("antalya");
    expect(d.longitude).toBeCloseTo(30.7);
  });

  it("10 dk onbellekte tutar", async () => {
    findMany.mockResolvedValue([]);
    const svc = new CityCoverageService();
    await svc.districts("istanbul", 0);
    await svc.districts("ankara", 5 * 60 * 1000);
    expect(findMany).toHaveBeenCalledTimes(1);
    await svc.districts("istanbul", 11 * 60 * 1000);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/mobile/cities/[city]/districts", () => {
  const call = (city: string) =>
    GET(new NextRequest(`http://localhost/api/mobile/cities/${city}/districts`), { params: Promise.resolve({ city }) });

  it("bilinmeyen sehirde 200 ve bos liste (500 degil)", async () => {
    findMany.mockReset().mockResolvedValue([shop("İstanbul", "Kadıköy", 41, 29)]);
    const res = await call("atlantis");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ districts: [] });
  });

  it("govde mobile-dto bicimi: name, slug, shopCount, latitude, longitude", async () => {
    // Ayni onbellek (bir onceki test doldurdu): Istanbul'da tek dukkan.
    const res = await call("istanbul");
    expect(await res.json()).toEqual({
      districts: [{ name: "Kadıköy", slug: "kadikoy", shopCount: 1, latitude: 41, longitude: 29 }],
    });
  });
});
