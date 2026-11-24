import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Yayindaki dukkan pinini silemez (web action ve mobil uc ayni servis): mesafe
 * aramasi koordinatsiz dukkani dondurmez, misafir icin dukkan kaybolur.
 */
const { mockPrisma, mockAssess } = vi.hoisted(() => ({
  mockPrisma: { shop: { findUnique: vi.fn(), update: vi.fn() } },
  mockAssess: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/ShopSettingsImpact", () => ({ shopSettingsImpactService: { assess: mockAssess } }));
vi.mock("@/services/SlotService", () => ({ scheduleSlotGeneration: vi.fn() }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));

import { shopService } from "@/services/ShopService";

beforeEach(() => {
  vi.clearAllMocks();
  mockAssess.mockResolvedValue({ bookingsOutsideHours: 0, bagsOverCapacity: 0 });
  mockPrisma.shop.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "s1", ...data }));
});

describe("updateSettings konum silme", () => {
  it("aktif dukkanda null,null reddedilir, yazma olmaz", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({ isActive: true });
    const res = await shopService.updateSettings("s1", { latitude: null, longitude: null });
    expect(res).toEqual({ ok: false, reason: "coordinates_required" });
    expect(mockPrisma.shop.update).not.toHaveBeenCalled();
  });

  it("bekleyen/pasif dukkanda silme serbest", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({ isActive: false });
    const res = await shopService.updateSettings("s1", { latitude: null, longitude: null });
    expect(res.ok).toBe(true);
    expect(mockPrisma.shop.update.mock.calls[0][0].data).toMatchObject({ latitude: null, longitude: null });
  });

  it("pini tasimak aktif dukkanda da serbest ve durum sorgusu yapilmaz", async () => {
    const res = await shopService.updateSettings("s1", { latitude: 41.01, longitude: 28.97 });
    expect(res.ok).toBe(true);
    expect(mockPrisma.shop.findUnique).not.toHaveBeenCalled();
  });
});
