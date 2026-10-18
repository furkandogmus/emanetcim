import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** Esnafin gunluk ozeti: web paneliyle ayni dukkan secimi ve ayni servis. */
const { mockRequireMobileUser, mockResolve, mockSnapshot, mockFindUnique, mockCommission } = vi.hoisted(() => ({
  mockRequireMobileUser: vi.fn(),
  mockResolve: vi.fn(),
  mockSnapshot: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCommission: vi.fn(),
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/lib/partner-shop", () => ({ resolvePartnerShops: mockResolve }));
vi.mock("@/lib/commission", () => ({ getEffectiveCommission: mockCommission }));
vi.mock("@/lib/db", () => ({ default: { shop: { findUnique: mockFindUnique } } }));
vi.mock("@/services/PartnerDashboardService", () => ({
  partnerDashboardService: { getSnapshot: mockSnapshot },
}));

import { GET } from "@/app/api/mobile/partner/dashboard/route";

const SNAPSHOT = {
  todayArrivals: 3,
  todayPickups: 2,
  bagsInStorage: 5,
  monthNet: 1200,
  prevMonthNet: 0,
  monthChangePct: null,
  bagsHandledAllTime: 40,
};

function req(query = "") {
  return new NextRequest(`https://bagajpark.com/api/mobile/partner/dashboard${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
  mockResolve.mockResolvedValue({ shops: [{ id: "s1", name: "A" }], activeShop: { id: "s1", name: "A" } });
  mockFindUnique.mockResolvedValue({ timezone: "Europe/Istanbul" });
  mockCommission.mockResolvedValue({ rate: 0.1, merchantShareRatio: 0.9 });
  mockSnapshot.mockResolvedValue(SNAPSHOT);
});

describe("mobil esnaf ozeti", () => {
  it("web paneliyle ayni servisi dukkanin dilimi ve komisyonla cagirir", async () => {
    const res = (await GET(req()))!;
    expect(res.status).toBe(200);
    expect(mockSnapshot).toHaveBeenCalledWith("s1", "Europe/Istanbul", 0.1);
    expect(await res.json()).toEqual({
      shop: { id: "s1", name: "A" },
      shops: [{ id: "s1", name: "A" }],
      todayArrivals: 3,
      todayPickups: 2,
      bagsInStorage: 5,
      monthNet: 1200,
      prevMonthNet: 0,
      monthChangePct: null,
    });
  });

  it("?shop= web ile ayni secime iletilir", async () => {
    await GET(req("?shop=s2"));
    expect(mockResolve).toHaveBeenCalledWith("p1", "s2");
  });

  it("dukkansiz esnafa 404 no_shops", async () => {
    mockResolve.mockResolvedValue({ shops: [], activeShop: null });
    const res = (await GET(req()))!;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_shops" });
    expect(mockSnapshot).not.toHaveBeenCalled();
  });

  it("misafir 403", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { id: "g1", role: "GUEST" } });
    const res = (await GET(req()))!;
    expect(res.status).toBe(403);
    expect(mockSnapshot).not.toHaveBeenCalled();
  });
});
