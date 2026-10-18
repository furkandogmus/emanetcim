import { describe, it, expect, vi, beforeEach } from "vitest";

/** Web paneli ve mobil esnaf uçlarının ortak dükkan seçimi. */
const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany: mockFindMany } } }));

import { resolvePartnerShops } from "@/lib/partner-shop";

const OWN = [
  { id: "new", name: "Yeni" },
  { id: "old", name: "Eski" },
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
    expect((await resolvePartnerShops("p1", "old")).activeShop).toEqual({ id: "old", name: "Eski" });
  });

  it("başkasının dükkan kimliği varsayılana düşer, o dükkana erişim vermez", async () => {
    expect((await resolvePartnerShops("p1", "someone-elses")).activeShop).toEqual({ id: "new", name: "Yeni" });
  });

  it("dükkanı yoksa activeShop null", async () => {
    mockFindMany.mockResolvedValue([]);
    expect((await resolvePartnerShops("p1", "x")).activeShop).toBeNull();
  });
});
