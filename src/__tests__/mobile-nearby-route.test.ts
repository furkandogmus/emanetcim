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
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: async () => ({
    maxStayDays: 30,
    bagMultiplierS: 0.7,
    bagMultiplierM: 1,
    bagMultiplierXl: 1.5,
    insuranceFeeTry: 0,
  }),
}));
vi.mock("@/lib/booking-server-price", () => ({
  validateBookingStayWindow: () => true,
  MIN_BOOKING_STAY_MS: 3_600_000,
}));
vi.mock("@/lib/mobile-dto", () => ({
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

  it("sınırsız r / limit / page reddedilir", async () => {
    for (const q of [{ r: "9999999" }, { limit: "5000" }, { page: "0" }, { page: "-3" }, { lat: "999" }] as Record<string, string>[]) {
      expect((await GET(url(q))).status).toBe(400);
    }
  });
});
