import { describe, it, expect, vi, beforeEach } from "vitest";

/** Web paneli ve mobil esnaf uçlarının ortak dükkan seçimi. */
const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
const { mockMembers } = vi.hoisted(() => ({ mockMembers: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany: mockFindMany }, shopMember: { findMany: mockMembers } } }));

import { resolvePartnerShops } from "@/lib/partner-shop";

const OWN = [
  { id: "new", name: "Yeni", isActive: true },
  { id: "old", name: "Eski", isActive: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue(OWN);
  mockMembers.mockResolvedValue([]);
});

describe("resolvePartnerShops", () => {
  it("yalnızca esnafın kendi dükkanlarını sabit sırayla okur", async () => {
    await resolvePartnerShops("p1");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "p1" }, orderBy: { createdAt: "desc" } }),
    );
  });

  it("istenen dükkan kendisininse onu seçer", async () => {
    expect((await resolvePartnerShops("p1", "old")).activeShop).toEqual({ id: "old", name: "Eski", isActive: true , relation: "owner" });
  });

  it("başkasının dükkan kimliği varsayılana düşer, o dükkana erişim vermez", async () => {
    expect((await resolvePartnerShops("p1", "someone-elses")).activeShop).toEqual({ id: "new", name: "Yeni", isActive: true , relation: "owner" });
  });

  it("istek yoksa en yeni AKTİF dükkanı seçer", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "pending", name: "Başvuru", isActive: false },
      { id: "live", name: "Hizmette", isActive: true },
    ]);
    expect((await resolvePartnerShops("p1")).activeShop).toEqual({ id: "live", name: "Hizmette", isActive: true , relation: "owner" });
  });

  it("dükkanı yoksa activeShop null", async () => {
    mockFindMany.mockResolvedValue([]);
    expect((await resolvePartnerShops("p1", "x")).activeShop).toBeNull();
  });

  it("manage (varsayılan) personel dükkanlarını hiç okumaz", async () => {
    await resolvePartnerShops("p1");
    expect(mockMembers).not.toHaveBeenCalled();
  });

  it("operate: personel olunan dükkan listede ve seçilebilir; ilişki staff", async () => {
    mockMembers.mockResolvedValue([{ shop: { id: "hotel", name: "Otel", isActive: true } }]);
    const r = await resolvePartnerShops("p1", "hotel", "operate");
    expect(r.shops.map((s) => s.id)).toEqual(["new", "old", "hotel"]);
    expect(r.activeShop).toEqual({ id: "hotel", name: "Otel", isActive: true, relation: "staff" });
  });
});
