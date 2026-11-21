import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    user: { create: vi.fn(), updateMany: vi.fn() },
    shop: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    mockTx,
    mockPrisma: {
      user: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { partnerOnboardingService } from "@/services/PartnerOnboardingService";

const INPUT = {
  ownerName: "Test Owner",
  phone: "0555 111 22 33",
  shopName: "Test Shop",
  shopAddress: "Test Cd. No:1",
  latitude: 36.5,
  longitude: 32.0,
  actor: { id: "admin-1", role: "ADMIN" },
};

describe("esnaf acilisinda misafirin tuttugu telefon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.user.create.mockResolvedValue({ id: "p-1" });
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockTx.shop.create.mockResolvedValue({ id: "s-1" });
  });

  it("numara bir MISAFIRdeyse ayni transaction'da bosaltilir, denetim yazilir, esnaf acilir", async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { phone?: string } }) =>
      where.phone ? { id: "g-1", role: "GUEST" } : null,
    );
    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);
    expect(res).toMatchObject({ ok: true, userId: "p-1", shopId: "s-1", phone: "5551112233" });
    expect(mockTx.user.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "g-1", role: "GUEST", phone: "5551112233" },
      data: { phone: null },
    });
    expect(mockTx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      actorUserId: "admin-1",
      actorRole: "ADMIN",
      action: "partner.guest_phone_released",
      entityId: "g-1",
    });
  });

  it("numara PARTNER/ADMIN hesaptaysa reddedilir, hicbir sey yazilmaz", async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { phone?: string } }) =>
      where.phone ? { id: "p-9", role: "PARTNER" } : null,
    );
    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);
    expect(res).toEqual({ ok: false, reason: "phone_already_registered" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("yarista numara el degistirmisse (count 0) reddedilir ve esnaf acilmaz", async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { phone?: string } }) =>
      where.phone ? { id: "g-1", role: "GUEST" } : null,
    );
    mockTx.user.updateMany.mockResolvedValue({ count: 0 });
    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);
    expect(res).toEqual({ ok: false, reason: "phone_already_registered" });
    expect(mockTx.user.create).not.toHaveBeenCalled();
  });

  it("numara kimsede degilse devralma yolu calismaz", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);
    expect(res.ok).toBe(true);
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
  });
});
