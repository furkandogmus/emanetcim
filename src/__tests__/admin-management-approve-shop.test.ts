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
  mockShopService: { approveApplication: vi.fn() },
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

  // Denetim kaydi artik `approveApplication`ta (mobil uc da oradan gecer);
  // kaydin yazildigi `ShopService.application-audit.test.ts`te olculur.
  it("delegates to shopService.approveApplication — partnere onay e-postası + SMS + denetim kaydı tek yol", async () => {
    mockShopService.approveApplication.mockResolvedValue({ ok: true });

    const result = await approveShopAction("shop-1");

    expect(mockShopService.approveApplication).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({ userId: "admin-1" }),
    );
    expect(result).toEqual({ success: true });
  });

  it("approveApplication başarısız dönerse hata fırlatır", async () => {
    mockShopService.approveApplication.mockResolvedValue({ ok: false, reason: "not_found" });

    await expect(approveShopAction("missing-shop")).rejects.toThrow();
  });

  it("admin olmayan kullanıcıyı reddeder", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "PARTNER" } });

    await expect(approveShopAction("shop-1")).rejects.toThrow();
    expect(mockShopService.approveApplication).not.toHaveBeenCalled();
  });
});
