import { describe, it, expect, vi, beforeEach } from "vitest";

/*
  Gercek `findShopsForSearch`: pencere tamamen kapanistan sonraysa dukkanin slotu
  yoktur. Mobil uc `includeOutsideHours` isterse dukkan `outsideHours` ile doner;
  istemezse eskisi gibi dusurulur.
*/
const { mockGetActiveShops, mockSlots, mockPrisma } = vi.hoisted(() => ({
  mockGetActiveShops: vi.fn(),
  mockSlots: vi.fn(),
  mockPrisma: { booking: { groupBy: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/shop-distance-postgis", () => ({ getActiveShopsOrderedByDistanceKm: mockGetActiveShops }));
vi.mock("@/services/SlotService", () => ({ getSlotAvailabilityForShops: mockSlots }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));

import { shopService } from "@/services/ShopService";

function shop(id: string, open247: boolean) {
  return {
    id, ownerId: "o", name: id, address: "a", city: "c", district: "d",
    latitude: 41, longitude: 29, capacity: 50, pricePerDay: 100,
    isActive: true, isTest: false, isPrelaunch: false, isVerified: true,
    open247, openingTime: "09:00", closingTime: "18:00", timezone: "Europe/Istanbul",
    rating: 4, image: null, sealLeadTimeDays: 2, sealReorderPoint: 15, responseTimeMinutes: null,
  };
}

const SEARCH = {
  centerLat: 41, centerLng: 29, radiusKm: 10,
  checkIn: new Date("2026-09-01T19:00:00+03:00"),
  checkOut: new Date("2026-09-01T23:00:00+03:00"),
  requestedBags: 1,
  ignoreOpenHours: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActiveShops.mockResolvedValue([
    { shop: shop("late", true), distanceKm: 2 },
    { shop: shop("day", false), distanceKm: 1 },
  ]);
  // Yalnizca 7/24 dukkanin pencerede slotu var.
  mockSlots.mockResolvedValue(new Map([["late", [{ available: 10 }]]]));
});

describe("pencere kapanistan sonra", () => {
  it("includeOutsideHours: slotsuz dukkan outsideHours ile, gercek sonuctan sonra doner", async () => {
    const hits = await shopService.findShopsForSearch({ ...SEARCH, includeOutsideHours: true });
    expect(hits.map((h) => h.id)).toEqual(["late", "day"]);
    expect(hits[0].outsideHours).toBeUndefined();
    expect(hits[1].outsideHours).toBe(true);
  });

  it("istenmezse eski davranis: slotsuz dukkan dusurulur", async () => {
    const hits = await shopService.findShopsForSearch(SEARCH);
    expect(hits.map((h) => h.id)).toEqual(["late"]);
  });
});
