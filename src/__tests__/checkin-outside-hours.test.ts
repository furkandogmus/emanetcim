/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SAAT DISI TESLIM ALMA — acik onayla (urun karari, 2026-11).
 *
 * NEDEN: dukkanlarin cogu sema varsayilani 09:00-20:00'da duruyordu. Gercekte
 * gec kapanan bir dukkan 20:40'ta gelen misafirin valizini alamiyordu; esnaf
 * "calisma saatleri icinde tekrar dene" yazisiyla kaliyor, misafir geri
 * donuyor ya da valiz sistem disinda aliniyordu.
 *
 * Kural: ilk istek yine `SHOP_CLOSED` doner. Esnaf onaylarsa istemci
 * `outsideHours: true` ile yineler; servis yalnizca dukkan SAHIBINDEN ya da
 * yoneticiden kabul eder ve olay kaydina `outside_hours: true` yazar.
 */

const { mockPrisma, mockTx, mockRecord, mockIsOpen } = vi.hoisted(() => {
  const mockTx = {
    booking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    mockTx,
    mockRecord: vi.fn().mockResolvedValue(undefined),
    mockIsOpen: vi.fn().mockReturnValue(false),
    mockPrisma: {
      booking: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/shop-schedule", () => ({ isOpenForHandover: mockIsOpen }));
vi.mock("@/services/ShopScheduleService", () => ({
  loadScheduleParts: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn().mockResolvedValue({ checkInGraceMin: 30, requireSealsOnCheckIn: false }),
}));
vi.mock("@/services/SealService", () => ({
  sealService: {
    assertCheckInSealsUsable: vi.fn(),
    applyCheckInWithinTx: vi.fn(),
  },
}));
vi.mock("@/services/PaymentService", () => ({
  paymentService: {
    capabilities: { capturesOnline: false },
    hasCapturedPayment: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: mockRecord },
}));

import { checkIn, canOverrideClosedHours } from "@/services/booking/check-in";

const OWNER = { id: "owner-1", role: "PARTNER" as const };
const BOOKING = {
  id: "b1",
  status: "PAID",
  shopId: "s1",
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  totalPrice: 100,
  bookingRowVersion: 0,
  shop: { id: "s1", ownerId: OWNER.id, open247: false, openingTime: "09:00", closingTime: "20:00", timezone: "Europe/Istanbul" },
  seals: [],
};

describe("saat disi teslim alma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOpen.mockReturnValue(false);
    mockPrisma.booking.findUnique.mockResolvedValue(BOOKING as any);
    mockTx.booking.updateMany.mockResolvedValue({ count: 1 });
  });

  it("onaysiz istek hala SHOP_CLOSED doner ve hicbir sey yazmaz", async () => {
    const res = await checkIn("b1", undefined, OWNER);
    expect(res).toMatchObject({ ok: false, code: "SHOP_CLOSED" });
    expect(mockTx.booking.updateMany).not.toHaveBeenCalled();
  });

  it("sahibin onayiyla teslim alinir ve olaya outside_hours yazilir", async () => {
    const res = await checkIn("b1", undefined, OWNER, { outsideHours: true });
    expect(res.ok).toBe(true);
    expect(mockTx.booking.updateMany).toHaveBeenCalledOnce();
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "CHECKED_IN",
        metadata: { previousStatus: "PAID", outside_hours: true },
      }),
    );
  });

  it("yonetici de onaylayabilir", async () => {
    const res = await checkIn("b1", undefined, { id: "admin-1", role: "ADMIN" as const }, { outsideHours: true });
    expect(res.ok).toBe(true);
  });

  it("baska dukkanin esnafi ya da aktorsuz cagri gecersiz kilamaz", async () => {
    const other = await checkIn("b1", undefined, { id: "other", role: "PARTNER" as const }, { outsideHours: true });
    expect(other).toMatchObject({ ok: false, code: "SHOP_CLOSED" });
    const anon = await checkIn("b1", undefined, undefined, { outsideHours: true });
    expect(anon).toMatchObject({ ok: false, code: "SHOP_CLOSED" });
    expect(mockTx.booking.updateMany).not.toHaveBeenCalled();
  });

  it("dukkan acikken bayrak denetim izine YAZILMAZ", async () => {
    mockIsOpen.mockReturnValue(true);
    const res = await checkIn("b1", undefined, OWNER, { outsideHours: true });
    expect(res.ok).toBe(true);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { previousStatus: "PAID" } }),
    );
  });

  it("canOverrideClosedHours: sahip ve yonetici evet, digerleri hayir", () => {
    const shop = { ownerId: "o" };
    expect(canOverrideClosedHours(shop, { id: "o", role: "PARTNER" })).toBe(true);
    expect(canOverrideClosedHours(shop, { id: "x", role: "ADMIN" })).toBe(true);
    expect(canOverrideClosedHours(shop, { id: "x", role: "PARTNER" })).toBe(false);
    expect(canOverrideClosedHours(shop, undefined)).toBe(false);
  });
});
