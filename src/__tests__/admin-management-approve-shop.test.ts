import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `approveShopAction` düz `prisma.shop.update({ isActive: true })` çağırıyordu:
 * dükkanı aktif ediyordu ama partnere HİÇBİR bildirim gitmiyordu.
 * `ShopService.approveShop` aynı işi yaparken partnere onay e-postası + SMS'i
 * de gönderiyor (P1-3), ama hiçbir çağıran onu kullanmıyordu — yalnızca
 * kullanılmayan `ApproveButton.tsx` üzerinden erişilebiliyordu. Canlıda
 * onaylanan HER esnaf bildirim almadan kalıyordu.
 */

const { mockAuth, mockShopService, mockAuditLog } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockShopService: { approveShop: vi.fn() },
  mockAuditLog: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/services/ShopService", () => ({ shopService: mockShopService }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAuditLog }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/lib/db", () => ({ default: {} }));

import { approveShopAction } from "@/actions/admin-management";

describe("approveShopAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  it("delegates to shopService.approveShop — bu, partnere onay e-postası + SMS gönderen tek yol", async () => {
    mockShopService.approveShop.mockResolvedValue({ ok: true });

    const result = await approveShopAction("shop-1");

    expect(mockShopService.approveShop).toHaveBeenCalledWith("shop-1");
    expect(result).toEqual({ success: true });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "shop.approve_application", entityId: "shop-1" }),
    );
  });

  it("shopService.approveShop false dönerse hata fırlatır ve audit log yazmaz", async () => {
    mockShopService.approveShop.mockResolvedValue({ ok: false, reason: "not_found" });

    await expect(approveShopAction("missing-shop")).rejects.toThrow();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("admin olmayan kullanıcıyı reddeder", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "PARTNER" } });

    await expect(approveShopAction("shop-1")).rejects.toThrow();
    expect(mockShopService.approveShop).not.toHaveBeenCalled();
  });
});
