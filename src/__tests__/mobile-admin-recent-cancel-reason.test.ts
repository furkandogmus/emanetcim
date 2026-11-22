import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** Yonetici ozet ve dukkan detayindaki `recent` satirlari da `cancelReason` tasir. */

const m = vi.hoisted(() => ({
  events: vi.fn(),
  overview: vi.fn(),
  shopDetail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: { bookingEvent: { findMany: m.events } } }));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(async () => ({ user: { id: "admin-1", role: "ADMIN" } })),
  requireRole: vi.fn(() => null),
}));
vi.mock("@/services/AdminOverviewService", () => ({ adminOverviewService: { overview: m.overview } }));
vi.mock("@/services/MobileInstallService", () => ({
  mobileInstallService: { activeCounts: vi.fn(async () => ({ day: 0, week: 0, month: 0, total: 0, signedInMonth: 0 })) },
}));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/services/ShopService", () => ({ shopService: {} }));
vi.mock("@/services/AdminOpsService", () => ({ adminOpsService: { shopDetail: m.shopDetail } }));
// Dukkan detayi DTO'su genis; burada yalniz `recent`in zenginlestirildigi olculur.
vi.mock("@/lib/mobile-dto", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-dto")>()),
  toMobileAdminShopDetail: (d: { recent: unknown[] }) => ({ recent: d.recent }),
}));

import { GET as overviewGET } from "@/app/api/mobile/admin/overview/route";
import { GET as shopGET } from "@/app/api/mobile/admin/shops/[id]/route";

const row = (id: string, status: string) => ({
  id,
  shopId: "s1",
  shop: { name: "Dükkan" },
  checkInTime: new Date("2030-01-01T09:00:00Z"),
  checkOutTime: new Date("2030-01-01T18:00:00Z"),
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  totalPrice: 50,
  status,
  guest: { name: "Ada" },
  guestEmail: null,
  createdAt: new Date("2029-12-31T00:00:00Z"),
});

beforeEach(() => {
  vi.clearAllMocks();
  m.events.mockResolvedValue([
    { bookingId: "c1", event: "CANCELLED", metadata: { reason: "no_show" }, createdAt: new Date() },
  ]);
});

describe("recent satirlarinda cancelReason", () => {
  it("admin/overview", async () => {
    m.overview.mockResolvedValue({ series: [], today: {}, attention: {}, totals: {}, recent: [row("c1", "CANCELLED"), row("p1", "PAID")] });
    const res = await overviewGET(new NextRequest("http://localhost/x"));
    const body = await res!.json();
    expect(body.recent.map((r: { cancelReason: string | null }) => r.cancelReason)).toEqual(["no_show", null]);
  });

  it("admin/shops/[id]", async () => {
    m.shopDetail.mockResolvedValue({ recent: [row("c1", "CANCELLED")] });
    const res = await shopGET(new NextRequest("http://localhost/x"), { params: Promise.resolve({ id: "s1" }) });
    const body = await res!.json();
    expect(body.recent[0].cancelReason).toBe("no_show");
  });
});
