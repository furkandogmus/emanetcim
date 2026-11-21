import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockAssess } = vi.hoisted(() => ({
  mockPrisma: { shop: { update: vi.fn() } },
  mockAssess: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn().mockResolvedValue({ defaultPricePerDay: 100 }),
}));
vi.mock("@/services/ShopSettingsImpact", () => ({
  shopSettingsImpactService: { assess: mockAssess },
}));

import { shopService } from "@/services/ShopService";

beforeEach(() => {
  vi.clearAllMocks();
  mockAssess.mockResolvedValue({ bookingsOutsideHours: 2, bagsOverCapacity: 0, affectedBookings: [] });
  mockPrisma.shop.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "s1", ...data }));
});

/**
 * Fiyat bandi ve etki olcumu iki tasiyicinin (web action + mobil uc) ORTAK govdesi.
 * Mobil uc ikisini de atliyordu: 250 yerine 2500 yazan esnaf aninda yayina giriyordu.
 */
describe("ShopService.updateSettings", () => {
  it("bandin disindaki fiyati YAZMADAN reddeder ve bandi soyler", async () => {
    const res = await shopService.updateSettings("s1", { pricePerDay: 1000 });
    expect(res).toEqual({ ok: false, reason: "price_out_of_range", min: 50, max: 200 });
    expect(mockPrisma.shop.update).not.toHaveBeenCalled();
  });

  it("bant ucundaki fiyati kabul eder, etkiyi yazmadan ONCE olcer", async () => {
    const res = await shopService.updateSettings("s1", { pricePerDay: 200, closingTime: "18:00" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.impact.bookingsOutsideHours).toBe(2);
    expect(mockAssess).toHaveBeenCalledWith({ shopId: "s1", openingTime: undefined, closingTime: "18:00", capacity: undefined });
    expect(mockAssess.mock.invocationCallOrder[0]).toBeLessThan(mockPrisma.shop.update.mock.invocationCallOrder[0]);
  });

  it("fiyat gonderilmediyse bant kontrolu yapilmaz", async () => {
    const res = await shopService.updateSettings("s1", { capacity: 5 });
    expect(res.ok).toBe(true);
  });
});
