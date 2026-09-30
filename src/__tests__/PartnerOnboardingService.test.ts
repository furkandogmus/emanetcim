import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    user: { create: vi.fn() },
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
  ownerName: " Merlin Home Tekstil ",
  phone: "0545 519 10 39",
  email: " Esnaf@Example.com ",
  shopName: "Merlin Home Tekstil",
  shopAddress: "Lale Sk. No:9, Alanya",
  city: "Antalya",
  district: "",
  latitude: 36.548,
  longitude: 31.998,
};

describe("PartnerOnboardingService.createPartnerWithShop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue({ id: "u-1" });
    mockTx.shop.create.mockResolvedValue({ id: "s-1" });
  });

  it("hesabı ŞİFRESİZ ve sözleşme onayı YAZMADAN, dükkanı PASİF açar", async () => {
    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);

    expect(res).toEqual({ ok: true, userId: "u-1", shopId: "s-1", phone: "5455191039" });

    const userData = mockTx.user.create.mock.calls[0][0].data;
    expect(userData).toMatchObject({
      role: "PARTNER",
      name: "Merlin Home Tekstil",
      phone: "5455191039",
      email: "esnaf@example.com",
      passwordHash: null,
    });
    // Sözleşme onayı esnafın kendi işlemidir; admin onu işaretleyemez.
    expect(userData).not.toHaveProperty("legalAcceptances");

    expect(mockTx.shop.create.mock.calls[0][0].data).toMatchObject({
      ownerId: "u-1",
      latitude: 36.548,
      longitude: 31.998,
      district: null,
      isActive: false,
    });
  });

  it("geçersiz telefonda hiçbir şey yazmaz", async () => {
    const res = await partnerOnboardingService.createPartnerWithShop({ ...INPUT, phone: "0212 123 45 67" });

    expect(res).toEqual({ ok: false, reason: "invalid_tr_phone" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("telefon zaten kayıtlıysa hiçbir şey yazmaz", async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { phone?: string } }) =>
      where.phone ? { id: "existing" } : null,
    );

    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);

    expect(res).toEqual({ ok: false, reason: "phone_already_registered" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("e-posta zaten kayıtlıysa hiçbir şey yazmaz", async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { email?: string } }) =>
      where.email ? { id: "existing" } : null,
    );

    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);

    expect(res).toEqual({ ok: false, reason: "email_already_registered" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("yarışta unique ihlali (P2002) anlamlı sonuca çevrilir", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));

    const res = await partnerOnboardingService.createPartnerWithShop(INPUT);

    expect(res).toEqual({ ok: false, reason: "phone_already_registered" });
  });
});
