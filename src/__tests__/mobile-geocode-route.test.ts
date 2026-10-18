import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * `GET /api/mobile/geocode`: mobil arama sihirbazinin serbest metin araması.
 * Gövde `geocodePlace` (web ile ortak); burada yalnizca taşıyıcı ölçülür.
 */
const { mockGeocode, mockRateLimit } = vi.hoisted(() => ({
  mockGeocode: vi.fn(),
  mockRateLimit: vi.fn(),
}));
vi.mock("@/lib/geocode", async (orig) => ({
  ...(await orig<typeof import("@/lib/geocode")>()),
  geocodePlace: mockGeocode,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));

import { GET } from "@/app/api/mobile/geocode/route";

const req = (q: string | null, headers: Record<string, string> = {}) =>
  new NextRequest(
    `https://bagajpark.com/api/mobile/geocode${q === null ? "" : `?q=${encodeURIComponent(q)}`}`,
    { headers },
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue(true);
});

describe("GET /api/mobile/geocode", () => {
  it("bulunan yeri istemcinin Place biçiminde döner", async () => {
    mockGeocode.mockResolvedValue({ lat: 40.99, lng: 29.02, label: "Kadıköy, İstanbul" });
    const res = await GET(req("Kadıköy"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      label: "Kadıköy, İstanbul",
      latitude: 40.99,
      longitude: 29.02,
    });
  });

  it("yanıt dilini Accept-Language'dan çözer", async () => {
    mockGeocode.mockResolvedValue({ lat: 1, lng: 2, label: "x" });
    await GET(req("Taksim", { "accept-language": "en-GB,en;q=0.9" }));
    expect(mockGeocode).toHaveBeenCalledWith("Taksim", "en");
  });

  it("çözülemeyen sorgu 404 not_found", async () => {
    mockGeocode.mockResolvedValue(null);
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
});
