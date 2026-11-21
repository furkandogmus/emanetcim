import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Listedeki toplam == odeme ekranindaki toplam. Ayni dukkan, ayni pencere ve ayni
 * valiz karisimi hem `shops/nearby` hem `checkout/quote`tan gecirilir. Pencere
 * kapanisa tasiyor (16:00-21:30 TRT, dukkan 09-18): iki uc da ayni oturtmayi yapmali.
 */
const { mockSearch, mockFindUnique } = vi.hoisted(() => ({ mockSearch: vi.fn(), mockFindUnique: vi.fn() }));

const RULES = {
  maxStayDays: 30,
  maxBagsPerSlot: 20,
  insuranceFeeTry: 15,
  earlyRefundRatio: 0.5,
  cancelFixedFeeTry: 0,
  latePickupFeeTry: 0,
  latePickupGraceMin: 0,
  checkInGraceMin: 0,
  requireSealsOnCheckIn: false,
  defaultShopCapacity: 10,
  defaultPricePerDay: 150,
  bagMultipliers: { S: 0.8, M: 1, XL: 1.5 },
  platformHolidayDates: [],
  platformCommissionRate: 0.2,
};

vi.mock("@/services/ShopService", () => ({
  shopService: { findShopsForSearch: mockSearch, findNearby: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ default: { shop: { findUnique: mockFindUnique } } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => true }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: async () => "1.1.1.1" }));
vi.mock("@/lib/mobile-auth", () => ({ requireMobileUser: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/services/ShopScheduleService", () => ({ loadScheduleParts: async () => new Map() }));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: async () => RULES }));
vi.mock("@/services/CouponService", () => ({ couponService: { preview: vi.fn() } }));
vi.mock("@/services/ReferralService", () => ({ referralService: { check: vi.fn() } }));

import { GET as nearby } from "@/app/api/mobile/shops/nearby/route";
import { POST as quote } from "@/app/api/mobile/checkout/quote/route";

const SHOP = {
  id: "11111111-1111-4111-8111-111111111111",
  pricePerDay: 137.5,
  isActive: true,
  isTest: false,
  isPrelaunch: false,
  open247: false,
  openingTime: "09:00",
  closingTime: "18:00",
  timezone: "Europe/Istanbul",
};

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-20T08:00:00.000Z"), toFake: ["Date"] });
  mockSearch.mockResolvedValue([{ ...SHOP, distanceKm: 1, bagsAvailable: 5 }]);
  mockFindUnique.mockResolvedValue(SHOP);
});

describe("liste toplamı == checkout/quote toplamı", () => {
  it.each([
    { label: "aynı gün, kapanışa oturtulur", snapped: true, ci: "2026-11-20T13:00:00.000Z", co: "2026-11-20T18:30:00.000Z", s: 1, m: 0, xl: 2 },
    { label: "üç gün", snapped: false, ci: "2026-11-20T09:00:00.000Z", co: "2026-11-23T08:00:00.000Z", s: 0, m: 2, xl: 1 },
  ])("$label", async ({ snapped, ci, co, s, m, xl }) => {
    const q = new URLSearchParams({
      lat: "41",
      lng: "29",
      checkIn: ci,
      checkOut: co,
      bags: String(s + m + xl),
      bagsS: String(s),
      bagsM: String(m),
      bagsXl: String(xl),
    });
    const list = await (await nearby(new NextRequest(`https://x.test/api/mobile/shops/nearby?${q}`))).json();
    const quoteRes = await quote(
      new NextRequest("https://x.test/api/mobile/checkout/quote", {
        method: "POST",
        body: JSON.stringify({ shopId: SHOP.id, checkInTime: ci, checkOutTime: co, bagCountS: s, bagCountM: m, bagCountXl: xl }),
      }),
    );
    const priced = await quoteRes!.json();
    expect(list[0].stayQuote).toEqual({ total: priced.total, days: priced.days, bags: s + m + xl });
    expect(list[0].hoursNotice).toEqual(priced.hoursNotice);
    expect(!!priced.hoursNotice?.pickup).toBe(snapped);
    expect(priced.total).toBeGreaterThan(RULES.insuranceFeeTry);
  });
});
