import { describe, it, expect, vi, beforeEach } from "vitest";

/** Web esnaf ayarlarinda dukkan adi (mobilde zaten vardi): ayni servis govdesi. */
const { mockAuth, mockPrisma, mockShopService } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: { shop: { findUnique: vi.fn() }, shopMember: { findUnique: vi.fn() } },
  mockShopService: { updateSettings: vi.fn() },
}));
// Gercek kapi (`requireShopAccess`) calisir; yalniz oturum ve veritabani sahte.
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/ShopService", () => ({ shopService: mockShopService }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIpOrNull: vi.fn() }));

import { updateShopSettingsAction } from "@/actions/shop";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
  mockPrisma.shop.findUnique.mockResolvedValue({ id: "s1", ownerId: "p1" });
  mockPrisma.shopMember.findUnique.mockResolvedValue(null);
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

  it("yayindaki dukkanin pinini silmek ayri bir hata anahtari doner", async () => {
    mockShopService.updateSettings.mockResolvedValue({ ok: false, reason: "coordinates_required" });
    const res = await updateShopSettingsAction("s1", { latitude: null, longitude: null });
    expect(res).toEqual({ success: false, error: "Errors.coordinatesRequired" });
  });

  it("baskasinin dukkaninin adi degismez", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({ id: "s1", ownerId: "baska" });
    const res = await updateShopSettingsAction("s1", { name: "Yeni" });
    expect(res).toEqual({ success: false, error: "Errors.unauthorized" });
  });

  it("dukkan personeli ayarlari degistiremez (manage)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "staff-1", role: "GUEST" } });
    mockPrisma.shop.findUnique.mockResolvedValue({ id: "s1", ownerId: "p1" });
    mockPrisma.shopMember.findUnique.mockResolvedValue({ id: "m1" });
    const res = await updateShopSettingsAction("s1", { name: "Yeni" });
    expect(res).toEqual({ success: false, error: "Errors.unauthorized" });
    expect(mockShopService.updateSettings).not.toHaveBeenCalled();
  });
});
