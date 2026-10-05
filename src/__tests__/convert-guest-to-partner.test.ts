import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    user: { updateMany: vi.fn() },
    shop: { create: vi.fn() },
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
  userId: "u-1",
  phone: "0545 519 10 39",
  shopName: "Merlin Home",
  shopAddress: "Lale Sk. No:9, Alanya",
  city: "Antalya",
  district: "",
  latitude: 36.548,
  longitude: 31.998,
};

describe("PartnerOnboardingService.convertGuestToPartner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { id: "u-1", role: "GUEST", passwordHash: "hash" } : null,
    );
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockTx.shop.create.mockResolvedValue({ id: "s-1" });
  });

  it("rolü, telefonu ve tokenVersion'ı tek transaction'da yazar, dükkanı PASİF açar", async () => {
    const res = await partnerOnboardingService.convertGuestToPartner(INPUT);

    expect(res).toEqual({ ok: true, shopId: "s-1", phone: "5455191039", hasPassword: true });
    expect(mockTx.user.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "u-1", role: "GUEST" },
      data: { role: "PARTNER", phone: "5455191039", tokenVersion: { increment: 1 } },
    });
    expect(mockTx.shop.create.mock.calls[0][0].data).toMatchObject({
      ownerId: "u-1",
      district: null,
      isActive: false,
    });
  });

  it("şifresiz misafirde hasPassword=false döner (bağ üretilsin diye)", async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { id: "u-1", role: "GUEST", passwordHash: null } : null,
    );
    const res = await partnerOnboardingService.convertGuestToPartner(INPUT);
    expect(res).toMatchObject({ ok: true, hasPassword: false });
  });

  it("misafir olmayan hesabı çevirmez", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u-1", role: "PARTNER", passwordHash: "h" });
    const res = await partnerOnboardingService.convertGuestToPartner(INPUT);
    expect(res).toEqual({ ok: false, reason: "not_guest" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("telefon başka hesaptaysa yazmaz", async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { id: "u-1", role: "GUEST", passwordHash: "h" } : { id: "u-2" },
    );
    const res = await partnerOnboardingService.convertGuestToPartner(INPUT);
    expect(res).toEqual({ ok: false, reason: "phone_already_registered" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("yarışta rol değişmişse dükkan açmaz", async () => {
    mockTx.user.updateMany.mockResolvedValue({ count: 0 });
    const res = await partnerOnboardingService.convertGuestToPartner(INPUT);
    expect(res).toEqual({ ok: false, reason: "not_guest" });
    expect(mockTx.shop.create).not.toHaveBeenCalled();
  });
});
