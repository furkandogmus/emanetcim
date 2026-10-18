import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `getShopByOwner` mobil ayar/saat/fotograf uclarinin YAZDIGI dukkani secer.
 * Siralamasiz `findFirst` cok dukkanli esnafta degisikligi rastgele dukkana
 * yaziyordu; secim artik web paneliyle ayni (`resolvePartnerShops`).
 */
const { mockResolve, mockFindUnique, mockFindFirst } = vi.hoisted(() => ({
  mockResolve: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
}));
vi.mock("@/lib/partner-shop", () => ({ resolvePartnerShops: mockResolve }));
vi.mock("@/lib/db", () => ({ default: { shop: { findUnique: mockFindUnique, findFirst: mockFindFirst } } }));

import { shopService } from "@/services/ShopService";

beforeEach(() => {
  vi.clearAllMocks();
  mockResolve.mockResolvedValue({ shops: [{ id: "s2", name: "Galata" }], activeShop: { id: "s2", name: "Galata" } });
  mockFindUnique.mockResolvedValue({ id: "s2", name: "Galata" });
});

describe("shopService.getShopByOwner", () => {
  it("web ile ayni secimi kullanir, findFirst'e dusmez", async () => {
    const shop = await shopService.getShopByOwner("p1", "s2");
    expect(mockResolve).toHaveBeenCalledWith("p1", "s2");
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "s2" } });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(shop).toEqual({ id: "s2", name: "Galata" });
  });

  it("dukkan belirtilmezse secime undefined gider (web varsayilani)", async () => {
    await shopService.getShopByOwner("p1");
    expect(mockResolve).toHaveBeenCalledWith("p1", undefined);
  });

  it("dukkani yoksa null ve veritabanina ikinci sorgu yok", async () => {
    mockResolve.mockResolvedValue({ shops: [], activeShop: null });
    expect(await shopService.getShopByOwner("p1", "x")).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
