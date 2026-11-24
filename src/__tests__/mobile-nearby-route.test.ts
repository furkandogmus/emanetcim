import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * `GET /api/mobile/shops/nearby`: saate oturmayan dukkan, sinirlar, hata yolu.
 * Istanbul UTC+3; 2026-11-20 Cuma.
 */
const { mockSearch, mockRateLimit, mockSchedules } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockRateLimit: vi.fn(),
  mockSchedules: vi.fn(),
}));
vi.mock("@/services/ShopService", () => ({
  shopService: { findShopsForSearch: mockSearch, findNearby: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: async () => "1.1.1.1" }));
vi.mock("@/services/ShopScheduleService", () => ({ loadScheduleParts: mockSchedules }));
vi.mock("@/lib/platform-settings", async () => {
  const { DEFAULT_PRICING_RULES } = await import("@/lib/pricing-rules");
  return { getPricingRules: async () => ({ ...DEFAULT_PRICING_RULES, maxStayDays: 30 }) };
});
vi.mock("@/lib/booking-server-price", async (orig) => ({
  ...(await orig<typeof import("@/lib/booking-server-price")>()),
  validateBookingStayWindow: () => true,
}));
vi.mock("@/lib/mobile-dto", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-dto")>()),
  toMobileShop: (s: { id: string }) => ({ id: s.id }),
  toMobilePriceRange: () => ({ min: 1, max: 2, medium: 1 }),
}));

import { GET } from "@/app/api/mobile/shops/nearby/route";

const shopRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  isPrelaunch: false,
  open247: false,
  openingTime: "09:00",
  closingTime: "18:00",
  timezone: "Europe/Istanbul",
  pricePerDay: 100,
  distanceKm: 1,
  bagsAvailable: 5,
  ...over,
});

const url = (q: Record<string, string>) => {
  const p = new URLSearchParams({
    lat: "41",
    lng: "29",
    checkIn: "2026-11-20T14:30:00.000Z", // 17:30 TRT
    checkOut: "2026-11-20T18:30:00.000Z", // 21:30 TRT
    ...q,
  });
  return new NextRequest(`https://bagajpark.com/api/mobile/shops/nearby?${p}`);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue(true);
  mockSchedules.mockResolvedValue(new Map());
});

describe("GET /api/mobile/shops/nearby", () => {
  it("akşam aramada saate oturmayan dükkanı bookable:false + nextOpen ile sona koyar (includeClosed)", async () => {
    mockSearch.mockResolvedValue([shopRow("closed"), shopRow("always", { open247: true })]);
    const res = await GET(url({ includeClosed: "1" }));
    const body = await res.json();
    expect(body.map((s: { id: string }) => s.id)).toEqual(["always", "closed"]);
    expect(body[0].bookable).toBe(true);
    expect(body[1]).toMatchObject({ bookable: false, nextOpen: { date: "2026-11-21", at: "09:00" } });
  });

  it("eski istemci (includeClosed yok) kapalı dükkanı eskisi gibi hiç görmez", async () => {
    mockSearch.mockResolvedValue([shopRow("closed"), shopRow("always", { open247: true })]);
    const body = await (await GET(url({}))).json();
    expect(body.map((s: { id: string }) => s.id)).toEqual(["always"]);
  });

  it("servis hatası boş liste değil 503", async () => {
    mockSearch.mockRejectedValue(new Error("db"));
    const res = await GET(url({}));
    expect(res.status).toBe(503);
  });

  it("sınırsız r / limit / page reddedilmez, kırpılır; geçersiz enlem 400", async () => {
    mockSearch.mockResolvedValue([]);
    expect((await GET(url({ r: "9999999" }))).status).toBe(200);
    expect(mockSearch.mock.calls.at(-1)?.[0].radiusKm).toBe(50);
    expect((await GET(url({ limit: "5000", page: "-3" }))).status).toBe(200);
    expect((await GET(url({ lat: "999" }))).status).toBe(400);
    expect((await GET(url({ r: "abc" }))).status).toBe(400);
  });

  it("boy karışımı gelirse her açık dükkana stayQuote eklenir ve arama toplam adetle yapılır", async () => {
    mockSearch.mockResolvedValue([shopRow("always", { open247: true }), shopRow("closed")]);
    const body = await (await GET(url({ includeClosed: "1", bags: "1", bagsS: "1", bagsM: "0", bagsXl: "2" }))).json();
    expect(mockSearch.mock.calls[0][0].requestedBags).toBe(3);
    expect(body[0].stayQuote).toMatchObject({ days: 1, bags: 3 });
    expect(body[0].stayQuote.total).toBeGreaterThan(0);
    expect(body[1].stayQuote).toBeUndefined();
  });

  it("eski istemci (yalnızca bags) eski yanıt biçimini alır: stayQuote yok", async () => {
    mockSearch.mockResolvedValue([shopRow("always", { open247: true })]);
    const body = await (await GET(url({ bags: "4" }))).json();
    expect(mockSearch.mock.calls[0][0].requestedBags).toBe(4);
    expect(body[0]).not.toHaveProperty("stayQuote");
  });

  it("boy adedi sınırı checkout/quote ile aynı: 21 reddedilir", async () => {
    mockSearch.mockResolvedValue([]);
    expect((await GET(url({ bagsXl: "21" }))).status).toBe(400);
  });

  describe("süzgeç ve sıralama (web SearchClient ile aynı)", () => {
    const open = { open247: true };
    const rows = () => [
      shopRow("a", { ...open, distanceKm: 3, pricePerDay: 300, rating: 4.8, hasCctv: true, hasClimateControl: true, acceptsLargeItems: false }),
      shopRow("b", { ...open, distanceKm: 1, pricePerDay: 200, rating: 0, hasCctv: false, hasClimateControl: true, acceptsLargeItems: true }),
      shopRow("c", { ...open, distanceKm: 2, pricePerDay: 250, rating: 4.1, hasCctv: true, hasClimateControl: false, acceptsLargeItems: true }),
    ];
    const ids = async (q: Record<string, string>) =>
      ((await (await GET(url(q))).json()) as { id: string }[]).map((s) => s.id);

    it("parametre yoksa servis sırası korunur", async () => {
      mockSearch.mockResolvedValue(rows());
      expect(await ids({})).toEqual(["a", "b", "c"]);
    });

    it("olanak süzgeçleri birlikte uygulanır", async () => {
      mockSearch.mockResolvedValue(rows());
      expect(await ids({ cctv: "1" })).toEqual(["a", "c"]);
      expect(await ids({ cctv: "1", largeItems: "1" })).toEqual(["c"]);
      expect(await ids({ climate: "true" })).toEqual(["a", "b"]);
    });

    it("azami fiyat pricePerDay'e, asgari puan rating'e bakar (puansız 0)", async () => {
      mockSearch.mockResolvedValue(rows());
      expect(await ids({ maxPrice: "250" })).toEqual(["b", "c"]);
      expect(await ids({ minRating: "4" })).toEqual(["a", "c"]);
    });

    it("sıralamalar", async () => {
      mockSearch.mockResolvedValue(rows());
      expect(await ids({ sort: "distance" })).toEqual(["b", "c", "a"]);
      expect(await ids({ sort: "price_asc" })).toEqual(["b", "c", "a"]);
      expect(await ids({ sort: "price_desc" })).toEqual(["a", "c", "b"]);
      expect(await ids({ sort: "rating" })).toEqual(["a", "c", "b"]);
    });

    it("sıralamada da rezervasyon alamayan dükkan sonda kalır", async () => {
      mockSearch.mockResolvedValue([shopRow("closed", { distanceKm: 0.1 }), ...rows()]);
      expect(await ids({ includeClosed: "1", sort: "distance" })).toEqual(["b", "c", "a", "closed"]);
    });

    it("geçersiz değerler 400", async () => {
      mockSearch.mockResolvedValue([]);
      expect((await GET(url({ sort: "cheapest" }))).status).toBe(400);
      expect((await GET(url({ minRating: "6" }))).status).toBe(400);
      expect((await GET(url({ maxPrice: "-1" }))).status).toBe(400);
      expect((await GET(url({ cctv: "yes" }))).status).toBe(400);
    });
  });
});
