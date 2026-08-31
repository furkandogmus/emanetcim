import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * MESAFE SIRALAMASININ YEDEK YOLU GORUNUR OLMALI.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `getActiveShopsOrderedByDistanceKm`
 * PostGIS sorgusunu `try` icinde calistirip `catch {}` -- GOVDESI BOS -- ile
 * yakaliyordu. PostGIS eklentisi kurulu degilse ya da sorgu hata verirse arama
 * `fallbackActiveShopsByDistance`e dusuyor: **butun** aktif dukkanlari bellege
 * alip orada siraliyor.
 *
 * Bunu tehlikeli yapan sey, YANLIS SONUC URETMEMESI. Siralama dogru cikiyor,
 * yani disaridan hicbir sey bozuk gorunmuyor -- ama sitenin en cok trafik alan
 * sayfasi her istekte tam tablo tariyor ve bellek ici siralama yapiyor. Hicbir
 * log, hicbir metrik, hicbir saglik alani bunu soylemiyordu.
 *
 * `docker-compose.yml` `postgis/postgis` imajini kullaniyor ama eklentiyi kuran
 * bir migration YOK: eklenti imajin acilis betigine bagli, yani eski bir veri
 * biriminden gecilmisse kurulu olmayabilir. Yani bu, teorik bir ihtimal degil.
 *
 * `rules/observability`: bir uretim bozulmasini gizleyen sessiz yedek yol,
 * bozulmanin kendisinden pahalidir.
 */

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    shop: { findMany: vi.fn() },
  },
  mockLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: mockLogger }));

const CENTER = { centerLat: 41.0, centerLng: 29.0, radiusKm: null };

async function loadModule() {
  vi.resetModules();
  return await import("@/lib/shop-distance-postgis");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
});

describe("mesafe siralamasinin arka ucu", () => {
  it("PostGIS calisiyorken yedek yola dusmez ve uyari yazmaz", async () => {
    const mod = await loadModule();
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "s1", dist_km: 1.5 }]);
    mockPrisma.shop.findMany.mockResolvedValue([
      { id: "s1", latitude: 41.1, longitude: 29.1 },
    ]);

    const out = await mod.getActiveShopsOrderedByDistanceKm(CENTER);

    expect(out).toHaveLength(1);
    expect(mod.getShopDistanceBackend()).toBe("postgis");
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("PostGIS hata verince yedek yola duser VE uyari yazar", async () => {
    const mod = await loadModule();
    mockPrisma.$queryRaw.mockRejectedValue(
      new Error('function postgis_version() does not exist'),
    );
    // Yedek yol: TUM aktif dukkanlari cekip bellekte siralar.
    mockPrisma.shop.findMany.mockResolvedValue([
      { id: "s1", latitude: 41.1, longitude: 29.1 },
      { id: "s2", latitude: 41.5, longitude: 29.5 },
    ]);

    const out = await mod.getActiveShopsOrderedByDistanceKm(CENTER);

    expect(out).toHaveLength(2);
    expect(out[0].shop.id, "yedek yol yine de mesafeye gore siralamali").toBe("s1");
    expect(mod.getShopDistanceBackend()).toBe("in_memory_fallback");
    expect(
      mockLogger.warn,
      "Sessiz yedek yol YASAK: uretimde tam tablo taramasina dusuldugunu " +
        "soyleyen bir kayit olmali.",
    ).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.anything() }),
      "shop_distance_postgis_unavailable_using_memory_fallback",
    );
  });

  it("uyari her aramada DEGIL, durum degistiginde yazilir", async () => {
    /*
      Her arama icin bir satir yazmak log'u bosaltir ve asil sinyali gomer --
      yani gurultu, sessizligin baska bir bicimi olur.
    */
    const mod = await loadModule();
    mockPrisma.$queryRaw.mockRejectedValue(new Error("no postgis"));
    mockPrisma.shop.findMany.mockResolvedValue([]);

    await mod.getActiveShopsOrderedByDistanceKm(CENTER);
    await mod.getActiveShopsOrderedByDistanceKm(CENTER);
    await mod.getActiveShopsOrderedByDistanceKm(CENTER);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it("PostGIS geri gelince bunu da yazar", async () => {
    const mod = await loadModule();
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("no postgis"));
    mockPrisma.shop.findMany.mockResolvedValue([]);
    await mod.getActiveShopsOrderedByDistanceKm(CENTER);
    expect(mod.getShopDistanceBackend()).toBe("in_memory_fallback");

    mockPrisma.$queryRaw.mockResolvedValue([]);
    await mod.getActiveShopsOrderedByDistanceKm(CENTER);

    expect(mod.getShopDistanceBackend()).toBe("postgis");
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ previous: "in_memory_fallback" }),
      "shop_distance_postgis_restored",
    );
  });
});
