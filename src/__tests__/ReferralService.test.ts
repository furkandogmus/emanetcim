import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * MISAFIR REFERANS INDIRIMI — tek kural.
 *
 * 2026-09-23'e kadar kural uc yerdeydi ve hicbiri uctan uca calismiyordu:
 * web odeme ekrani da mobil de kodu gondermiyordu, metin "ilk rezervasyonunda"
 * derken hesap her rezervasyonda indiriyordu, onizleme orani kirpmiyordu.
 */
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    booking: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { getReferralDiscountPct, referralService } from "@/services/ReferralService";

const GUEST_OWNER = { id: "davet-eden", role: "GUEST" };

describe("ReferralService", () => {
  const originalPct = process.env.REFERRAL_DISCOUNT_PCT;
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REFERRAL_DISCOUNT_PCT;
    mockPrisma.user.findUnique.mockResolvedValue(GUEST_OWNER);
    mockPrisma.booking.count.mockResolvedValue(0);
  });
  afterEach(() => {
    if (originalPct === undefined) delete process.env.REFERRAL_DISCOUNT_PCT;
    else process.env.REFERRAL_DISCOUNT_PCT = originalPct;
  });

  it("oran varsayilan 5, %0-50 arasina kirpilir", () => {
    expect(getReferralDiscountPct()).toBe(5);
    process.env.REFERRAL_DISCOUNT_PCT = "80";
    expect(getReferralDiscountPct()).toBe(50);
    process.env.REFERRAL_DISCOUNT_PCT = "-3";
    expect(getReferralDiscountPct()).toBe(0);
    process.env.REFERRAL_DISCOUNT_PCT = "abc";
    expect(getReferralDiscountPct()).toBe(0);
  });

  it("ilk rezervasyonda %5 indirir ve kodu buyuk harfe cevirir", async () => {
    const r = await referralService.resolveDiscount(" abcd2345 ", { userId: "misafir" }, 150);
    expect(r).toEqual({ code: "ABCD2345", discountAmount: 7.5, totalPrice: 142.5 });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { referralCode: "ABCD2345" } }),
    );
  });

  it("iptal edilmemis onceki rezervasyon varsa indirim yok", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    expect(await referralService.check("ABCD2345", { userId: "misafir" })).toEqual({
      ok: false,
      reason: "not_first_booking",
    });
    expect(await referralService.resolveDiscount("ABCD2345", { userId: "misafir" }, 150)).toBeNull();
  });

  it("kendi kodunu kullanamaz", async () => {
    expect(await referralService.check("ABCD2345", { userId: "davet-eden" })).toEqual({
      ok: false,
      reason: "own_code",
    });
  });

  it("esnaf kodu misafir indirimi vermez", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "esnaf", role: "PARTNER" });
    expect(await referralService.check("ABCD2345", { userId: "misafir" })).toEqual({
      ok: false,
      reason: "invalid_code",
    });
  });

  it("hesapsiz misafirde ilk rezervasyon e-postayla sayilir", async () => {
    await referralService.resolveDiscount("ABCD2345", { guestEmail: "Ali@Ornek.com" }, 100);
    expect(mockPrisma.booking.count).toHaveBeenCalledWith({
      where: {
        guestEmail: { equals: "ali@ornek.com", mode: "insensitive" },
        status: { not: "CANCELLED" },
      },
    });
  });

  it("misafir taninmiyorsa rezervasyonda indirim uygulanmaz", async () => {
    expect(await referralService.resolveDiscount("ABCD2345", {}, 100)).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
