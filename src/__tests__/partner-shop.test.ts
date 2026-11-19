import { describe, it, expect, vi, beforeEach } from "vitest";

/** Web paneli ve mobil esnaf uçlarının ortak dükkan seçimi. */
const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany: mockFindMany } } }));

import { resolvePartnerShops } from "@/lib/partner-shop";

const OWN = [
  { id: "new", name: "Yeni", isActive: true },
  { id: "old", name: "Eski", isActive: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue(OWN);
});

describe("resolvePartnerShops", () => {
  it("yalnızca esnafın kendi dükkanlarını sabit sırayla okur", async () => {
    await resolvePartnerShops("p1");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "p1" }, orderBy: { createdAt: "desc" } }),
    );
  });

  it("istenen dükkan kendisininse onu seçer", async () => {
    expect((await resolvePartnerShops("p1", "old")).activeShop).toEqual({ id: "old", name: "Eski", isActive: true });
  });

  it("başkasının dükkan kimliği varsayılana düşer, o dükkana erişim vermez", async () => {
    expect((await resolvePartnerShops("p1", "someone-elses")).activeShop).toEqual({ id: "new", name: "Yeni", isActive: true });
  });

  it("istek yoksa en yeni AKTİF dükkanı seçer", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "pending", name: "Başvuru", isActive: false },
      { id: "live", name: "Hizmette", isActive: true },
    ]);
    expect((await resolvePartnerShops("p1")).activeShop).toEqual({ id: "live", name: "Hizmette", isActive: true });
  });

  it("dükkanı yoksa activeShop null", async () => {
    mockFindMany.mockResolvedValue([]);
    expect((await resolvePartnerShops("p1", "x")).activeShop).toBeNull();
  });
});
