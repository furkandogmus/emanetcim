import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Basvuru karari denetim kaydi birakir -- web action, web API ucu ve mobil
 * admin ucu ayni metottan gecer. 2026-10-18'e kadar mobil uc ve web API ucu
 * kaydi hic yazmiyordu; red dukkani SILDIGI halde iz kalmiyordu.
 */
const { mockPrisma, mockReleaseShopSeals, mockAuditLog } = vi.hoisted(() => ({
  mockReleaseShopSeals: vi.fn(),
  mockAuditLog: vi.fn(),
  mockPrisma: {
    shop: { findUnique: vi.fn(), delete: vi.fn() },
    booking: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAuditLog }));
vi.mock("@/services/SealService", () => ({
  sealService: { releaseShopSeals: mockReleaseShopSeals },
}));

import { shopService } from "@/services/ShopService";
import { applicationActionResponse } from "@/lib/admin-application-response";

const actor = { userId: "admin-1", ip: "203.0.113.7" };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mockPrisma.shop.findUnique.mockResolvedValue({ id: "s1" });
  mockPrisma.booking.count.mockResolvedValue(0);
  mockPrisma.shop.delete.mockResolvedValue({ id: "s1" });
  mockReleaseShopSeals.mockResolvedValue(2);
});

describe("başvuru kararı denetim kaydı", () => {
  it("onay başarılıysa shop.approve_application yazılır", async () => {
    vi.spyOn(shopService, "approveShop").mockResolvedValue({ ok: true });
    await shopService.approveApplication("s1", actor);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "shop.approve_application",
        entityId: "s1",
        actorUserId: "admin-1",
        ip: "203.0.113.7",
      }),
    );
  });

  it("onay başarısızsa kayıt yazılmaz", async () => {
    vi.spyOn(shopService, "approveShop").mockResolvedValue({ ok: false, reason: "missing_coordinates" });
    await shopService.approveApplication("s1", actor);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("red serbest kalan mühür sayısıyla kaydedilir", async () => {
    await shopService.rejectApplication("s1", actor);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "shop.reject_application",
        entityId: "s1",
        metadata: { releasedSeals: 2 },
      }),
    );
  });

  it("aktif rezervasyonlu dükkan silinmez, kayıt yazılmaz", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    const r = await shopService.rejectApplication("s1", actor);
    expect(r).toEqual({ ok: false, reason: "has_active_bookings" });
    expect(mockPrisma.shop.delete).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

describe("uç yanıtı: istemcinin çevirdiği kodlar", () => {
  it.each([
    ["approve", { ok: false, reason: "missing_coordinates" }, 409, "missing_coordinates"],
    ["approve", { ok: false, reason: "not_found" }, 404, "not_found"],
  ] as const)("%s → %s", async (action, result, status, code) => {
    vi.spyOn(shopService, "approveApplication").mockResolvedValue(result);
    const res = await applicationActionResponse("s1", action, actor);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });

  it("aktif rezervasyon → 409 has_active_bookings", async () => {
    vi.spyOn(shopService, "rejectApplication").mockResolvedValue({ ok: false, reason: "has_active_bookings" });
    const res = await applicationActionResponse("s1", "reject", actor);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "has_active_bookings" });
  });

  it("bilinmeyen işlem → 400 invalid_action", async () => {
    const res = await applicationActionResponse("s1", "delete", actor);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_action" });
  });
});
