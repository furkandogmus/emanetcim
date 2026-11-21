import { describe, it, expect, vi, beforeEach } from "vitest";

const { svc } = vi.hoisted(() => ({
  svc: { adminUpdateShop: vi.fn(), shopDetail: vi.fn() },
}));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } }),
  requireRole: vi.fn().mockReturnValue(null),
}));
vi.mock("@/services/ShopService", () => ({ shopService: { adminUpdateShop: svc.adminUpdateShop } }));
vi.mock("@/services/AdminOpsService", () => ({ adminOpsService: { shopDetail: svc.shopDetail } }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: {} }));

import { PATCH } from "@/app/api/mobile/admin/shops/[id]/route";

const call = (body: unknown) =>
  PATCH(
    new Request("http://x/api/mobile/admin/shops/s1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "s1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  svc.adminUpdateShop.mockResolvedValue({ ok: true });
  svc.shopDetail.mockResolvedValue(null);
});

describe("PATCH /api/mobile/admin/shops/:id", () => {
  it("latitude/longitude kabul eder ve servise iletir", async () => {
    const res = await call({ latitude: 36.9, longitude: 30.7 });
    expect(res?.status).toBe(200);
    expect(svc.adminUpdateShop).toHaveBeenCalledWith("s1", { latitude: 36.9, longitude: 30.7 }, expect.anything());
  });

  it("bilinmeyen alanı 400 ile reddeder", async () => {
    const res = await call({ ownerId: "x" });
    expect(res?.status).toBe(400);
    expect(svc.adminUpdateShop).not.toHaveBeenCalled();
  });
});
