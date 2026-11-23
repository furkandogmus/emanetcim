import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * INCELEME KUM HAVUZU — arama sirasi ve slotsuz kapasite (2026-11-23).
 *
 * Test dukkanina slot uretilmez (`fillMissingSlots` yalnizca OPERATING). Slot
 * dalinda "slotu yok" diye elenirdi; kum havuzu hesabi onu hic goremezdi. Bu
 * dosya: (a) izleyici dagitim sorgusuna iletiliyor, (b) test dukkani slotsuz
 * kapasiteyle listeye giriyor ve EN BASTA, (c) gercek dukkanlarin sirasi ve
 * varligi degismiyor, (d) anonim aramada (sorgu test dukkani getirmez) sonuc
 * eskisiyle ayni.
 */

const { mockPrisma, mockGetActiveShops, mockSlots } = vi.hoisted(() => ({
  mockPrisma: { booking: { groupBy: vi.fn() } },
  mockGetActiveShops: vi.fn(),
  mockSlots: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/shop-distance-postgis", () => ({ getActiveShopsOrderedByDistanceKm: mockGetActiveShops }));
vi.mock("@/services/SlotService", () => ({
  getSlotAvailabilityForShops: mockSlots,
  generateSlotsForShop: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));

import { ShopService } from "@/services/ShopService";

const shop = (id: string, over: Record<string, unknown> = {}) => ({
  shop: { id, capacity: 10, open247: true, isActive: true, isTest: false, isPrelaunch: false, ...over },
  distanceKm: 1,
});

const checkIn = new Date("2026-11-24T10:00:00Z");
const checkOut = new Date("2026-11-24T14:00:00Z");
const slot = { id: "x", startTime: checkIn, endTime: checkOut, capacity: 10, reserved: 0, available: 10 };

const search = (viewer?: { reviewSandbox: boolean } | null) =>
  new ShopService().findShopsForSearch({
    centerLat: 41,
    centerLng: 29,
    radiusKm: 5,
    checkIn,
    checkOut,
    requestedBags: 1,
    viewer,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.booking.groupBy.mockResolvedValue([]);
});

describe("findShopsForSearch — kum havuzu", () => {
  it("izleyiciyi mesafe sorgusuna iletir; verilmezse anonim (null)", async () => {
    mockGetActiveShops.mockResolvedValue([]);
    await search({ reviewSandbox: true });
    expect(mockGetActiveShops.mock.calls[0][0]).toMatchObject({ viewer: { reviewSandbox: true } });
    await search();
    expect(mockGetActiveShops.mock.calls[1][0]).toMatchObject({ viewer: null });
  });

  it("test dukkani slotsuz kapasiteyle gelir ve gercek dukkanlardan ONCE durur", async () => {
    mockGetActiveShops.mockResolvedValue([shop("real-1"), shop("sandbox-1", { isTest: true }), shop("real-2")]);
    mockSlots.mockResolvedValue(new Map([["real-1", [slot]], ["real-2", [slot]]]));
    const hits = await search({ reviewSandbox: true });
    expect(hits.map((h) => h.id)).toEqual(["sandbox-1", "real-1", "real-2"]);
    expect(hits[0].bagsAvailable).toBe(10);
    // Slot sorgusuna test dukkani girmez: onun slotu yok, kapasitesi booking toplamindan.
    expect(mockSlots.mock.calls[0][0]).toEqual(["real-1", "real-2"]);
  });

  it("gercek dukkanlar test izleyicide de ayni: varlik ve sira degismez", async () => {
    const reals = [shop("real-1"), shop("real-2")];
    mockSlots.mockResolvedValue(new Map([["real-1", [slot]], ["real-2", [slot]]]));
    mockGetActiveShops.mockResolvedValue(reals);
    const anon = (await search()).map((h) => h.id);
    mockGetActiveShops.mockResolvedValue([...reals, shop("sandbox-1", { isTest: true })]);
    const sandboxView = (await search({ reviewSandbox: true })).map((h) => h.id);
    expect(sandboxView.filter((id) => !id.startsWith("sandbox"))).toEqual(anon);
  });

  it("dolu test dukkani listeye girmez (kapasite kurali aynen)", async () => {
    mockGetActiveShops.mockResolvedValue([shop("sandbox-1", { isTest: true, capacity: 2 })]);
    mockPrisma.booking.groupBy.mockResolvedValue([{ shopId: "sandbox-1", _sum: { bagCountS: 2, bagCountM: 0, bagCountXl: 0 } }]);
    expect(await search({ reviewSandbox: true })).toEqual([]);
  });

  it("anonim arama: test dukkani yoksa ek sorgu da yok", async () => {
    mockGetActiveShops.mockResolvedValue([shop("real-1")]);
    mockSlots.mockResolvedValue(new Map([["real-1", [slot]]]));
    const hits = await search(null);
    expect(hits.map((h) => h.id)).toEqual(["real-1"]);
    // Slot dalinda sonuc bulundu; kapasite (groupBy) sorgusu hic kosmadi.
    expect(mockPrisma.booking.groupBy).not.toHaveBeenCalled();
  });
});
