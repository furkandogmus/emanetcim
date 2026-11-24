import { describe, it, expect, vi, beforeEach } from "vitest";

/** Web esnaf ayarlarinda dukkan adi (mobilde zaten vardi): ayni servis govdesi. */
const { mockRequireUser, mockPrisma, mockShopService } = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
  mockPrisma: { shop: { findUnique: vi.fn() } },
  mockShopService: { updateSettings: vi.fn() },
}));
vi.mock("@/lib/action-auth", () => ({ requireUser: mockRequireUser, requirePartner: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/ShopService", () => ({ shopService: mockShopService }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIpOrNull: vi.fn() }));

import { updateShopSettingsAction } from "@/actions/shop";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ ok: true, actor: { id: "p1", role: "PARTNER" } });
  mockPrisma.shop.findUnique.mockResolvedValue({ ownerId: "p1" });
  mockShopService.updateSettings.mockResolvedValue({ ok: true, impact: { bookingsOutsideHours: 0, bagsOverCapacity: 0 } });
});

describe("updateShopSettingsAction dukkan adi", () => {
  it("bosluklari kirpilmis ad servise gider", async () => {
    const res = await updateShopSettingsAction("s1", { name: "  Kose Bakkal  " });
    expect(res.success).toBe(true);
    expect(mockShopService.updateSettings).toHaveBeenCalledWith("s1", { name: "Kose Bakkal" });
  });

  it.each(["", " a ", "x".repeat(201)])("gecersiz ad reddedilir: %j", async (name) => {
    const res = await updateShopSettingsAction("s1", { name });
    expect(res).toEqual({ success: false, error: "Errors.invalidData" });
    expect(mockShopService.updateSettings).not.toHaveBeenCalled();
  });

  it("baskasinin dukkaninin adi degismez", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({ ownerId: "baska" });
    const res = await updateShopSettingsAction("s1", { name: "Yeni" });
    expect(res).toEqual({ success: false, error: "Errors.unauthorized" });
  });
});
