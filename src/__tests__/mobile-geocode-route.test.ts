import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * `GET /api/mobile/geocode`: mobil arama sihirbazinin serbest metin araması.
 * Gövde `geocodePlaces` (Türkiye, beş sonuç); burada yalnizca taşıyıcı ölçülür.
 */
const { mockGeocode, mockRateLimit, mockViewer } = vi.hoisted(() => ({
  mockGeocode: vi.fn(),
  mockRateLimit: vi.fn(),
  mockViewer: vi.fn(),
}));
vi.mock("@/lib/mobile-auth", () => ({ resolveMobileShopViewer: mockViewer }));
vi.mock("@/lib/geocode", async (orig) => ({
  ...(await orig<typeof import("@/lib/geocode")>()),
  geocodePlaces: mockGeocode,
}));
// Onbellek surec ici calissin (Redis yok); Redis yolu geocode-cache.test.ts'de.
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit, getRedis: () => null }));

import { GET } from "@/app/api/mobile/geocode/route";
import { resetGeocodeCacheForTests } from "@/lib/geocode-cache";

const req = (q: string | null, headers: Record<string, string> = {}) =>
  new NextRequest(
    `https://bagajpark.com/api/mobile/geocode${q === null ? "" : `?q=${encodeURIComponent(q)}`}`,
    { headers },
  );

beforeEach(async () => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue(true);
  mockViewer.mockResolvedValue({ viewer: null, stale: false });
  await resetGeocodeCacheForTests();
});

describe("GET /api/mobile/geocode", () => {
  it("bulunan yeri istemcinin Place biçiminde döner", async () => {
    mockGeocode.mockResolvedValue({
      ok: true,
      places: [
        { lat: 40.99, lng: 29.02, label: "Kadıköy, İstanbul" },
        { lat: 41.0, lng: 29.0, label: "Kadıköy İskelesi, İstanbul" },
      ],
    });
    const res = await GET(req("Kadıköy"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      label: "Kadıköy, İstanbul",
      title: "Kadıköy, İstanbul",
      subtitle: "",
      latitude: 40.99,
      longitude: 29.02,
      items: [
        { label: "Kadıköy, İstanbul", title: "Kadıköy, İstanbul", subtitle: "", latitude: 40.99, longitude: 29.02 },
        { label: "Kadıköy İskelesi, İstanbul", title: "Kadıköy İskelesi, İstanbul", subtitle: "", latitude: 41.0, longitude: 29.0 },
      ],
    });
  });

  it("yanıt dilini Accept-Language'dan çözer", async () => {
    mockGeocode.mockResolvedValue({ ok: true, places: [{ lat: 1, lng: 2, label: "x" }] });
    await GET(req("Taksim", { "accept-language": "en-GB,en;q=0.9" }));
    expect(mockGeocode).toHaveBeenCalledWith("Taksim", "en", { countryCodes: "tr", limit: 5 });
  });

  it("Nominatim cokunce 'bulunamadi' degil 503 geocode_unavailable", async () => {
    mockGeocode.mockResolvedValue({ ok: false, reason: "upstream" });
    const res = await GET(req("Kadıköy"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "geocode_unavailable" });
  });

  it("çözülemeyen sorgu 404 not_found", async () => {
    mockGeocode.mockResolvedValue({ ok: true, places: [] });
    const res = await GET(req("qwertyzzz"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("kısa ya da eksik sorgu Nominatim'e gitmeden 400", async () => {
    for (const q of [null, "ka", "   ", "x".repeat(201)]) {
      const res = await GET(req(q));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_query" });
    }
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  it("hız sınırı aşılınca 429 ve Nominatim'e gidilmez", async () => {
    mockRateLimit.mockResolvedValue(false);
    const res = await GET(req("Kadıköy"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too_many_requests" });
    expect(mockGeocode).not.toHaveBeenCalled();
    expect(mockRateLimit.mock.calls[0][0]).toMatch(/^mobile_geocode:/);
  });

  it("onbellek: ayni (bosluk/harf farkli) sorgu Nominatim'e ikinci kez gitmez, gevsek IP sinirindan gecer", async () => {
    mockGeocode.mockResolvedValue({ ok: true, places: [{ lat: 40.99, lng: 29.02, label: "Kadıköy" }] });
    expect((await GET(req("Kadıköy İskele"))).status).toBe(200);
    const res = await GET(req("  kadıköy   iskele "));
    expect(res.status).toBe(200);
    expect((await res.json()).label).toBe("Kadıköy");
    expect(mockGeocode).toHaveBeenCalledTimes(1);
    const keys = mockRateLimit.mock.calls.map((c) => [c[0].replace(/:.*$/, ""), c[1]]);
    expect(keys).toEqual([
      ["mobile_geocode", 10],
      ["mobile_geocode_upstream_anon", 30],
      ["mobile_geocode_upstream", 60],
      ["mobile_geocode_hit", 120],
    ]);
  });

  it("onbellek dile bagli: ayni metin baska dilde yeniden sorulur", async () => {
    mockGeocode.mockResolvedValue({ ok: true, places: [{ lat: 1, lng: 2, label: "x" }] });
    await GET(req("Taksim", { "accept-language": "tr" }));
    await GET(req("Taksim", { "accept-language": "de" }));
    expect(mockGeocode).toHaveBeenCalledTimes(2);
  });

  it("bos sonuc da saklanir (404), Nominatim hatasi saklanmaz", async () => {
    mockGeocode.mockResolvedValueOnce({ ok: true, places: [] });
    expect((await GET(req("qwertyzzz"))).status).toBe(404);
    expect((await GET(req("qwertyzzz"))).status).toBe(404);
    expect(mockGeocode).toHaveBeenCalledTimes(1);

    mockGeocode.mockResolvedValueOnce({ ok: false, reason: "upstream" });
    expect((await GET(req("Moda"))).status).toBe(503);
    mockGeocode.mockResolvedValueOnce({ ok: true, places: [{ lat: 1, lng: 2, label: "Moda" }] });
    expect((await GET(req("Moda"))).status).toBe(200);
  });

  it("sunucu geneli Nominatim kotasi dolunca 429, Nominatim'e gidilmez", async () => {
    mockRateLimit.mockImplementation(async (key: string) => key !== "mobile_geocode_upstream");
    const res = await GET(req("Kadıköy"));
    expect(res.status).toBe(429);
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  it("anonim pay dolunca anonim 429 alir, oturumlu kullanici genel kovadan gecer", async () => {
    mockGeocode.mockResolvedValue({ ok: true, places: [{ lat: 1, lng: 2, label: "x" }] });
    mockRateLimit.mockImplementation(async (key: string) => key !== "mobile_geocode_upstream_anon");
    expect((await GET(req("rastgele-1"))).status).toBe(429);
    expect(mockGeocode).not.toHaveBeenCalled();
    // Anonim pay reddedilince genel kova hic sayilmaz.
    expect(mockRateLimit.mock.calls.map((c) => c[0])).not.toContain("mobile_geocode_upstream");

    mockRateLimit.mockClear();
    mockViewer.mockResolvedValue({ viewer: { id: "u1", reviewSandbox: false }, stale: false });
    const res = await GET(req("rastgele-2", { authorization: "Bearer t" }));
    expect(res.status).toBe(200);
    const keys = mockRateLimit.mock.calls.map((c) => [c[0], c[1]]);
    expect(keys).toEqual([
      ["mobile_geocode_user:u1", 20],
      ["mobile_geocode_upstream_auth", 45],
      ["mobile_geocode_upstream", 60],
    ]);
  });

  it("anonim pay genel siniri asagida tutar: oturumlulara en az yarisi kalir", async () => {
    mockGeocode.mockResolvedValue({ ok: true, places: [{ lat: 1, lng: 2, label: "x" }] });
    await GET(req("Kadikoy"));
    const limits = Object.fromEntries(mockRateLimit.mock.calls.map((c) => [String(c[0]).replace(/:.*$/, ""), c[1]]));
    expect(limits.mobile_geocode_upstream_anon * 2).toBeLessThanOrEqual(limits.mobile_geocode_upstream);
    expect(limits.mobile_geocode).toBeLessThan(20);
  });

  it("oturumlularin toplam payi dolunca 429: ucuz hesaplar genel kovayi bitiremez", async () => {
    mockGeocode.mockResolvedValue({ ok: true, places: [{ lat: 1, lng: 2, label: "x" }] });
    mockViewer.mockResolvedValue({ viewer: { id: "u9", reviewSandbox: false }, stale: false });
    mockRateLimit.mockImplementation(async (key: string) => key !== "mobile_geocode_upstream_auth");
    expect((await GET(req("rastgele-3", { authorization: "Bearer t" }))).status).toBe(429);
    expect(mockGeocode).not.toHaveBeenCalled();
    expect(mockRateLimit.mock.calls.map((c) => c[0])).not.toContain("mobile_geocode_upstream");
  });
});
