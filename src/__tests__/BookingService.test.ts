/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "../services/BookingService";
import { isShopOpenAt } from "@/lib/shop-hours";

const { mockGetPricingRules } = vi.hoisted(() => ({
  mockGetPricingRules: vi.fn().mockResolvedValue({
    maxStayDays: 30,
    maxBagsPerSlot: 50,
    insuranceFeeTry: 15,
    earlyRefundRatio: 0.9,
    cancelFixedFeeTry: 20,
    defaultShopCapacity: 10,
    defaultPricePerDay: 50,
    bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
    platformHolidayDates: [],
  }),
}));

const { mockTx, mockPrisma, mockRefundPayment, mockSealService } = vi.hoisted(() => {
  const mockRefundPayment = vi.fn();
  const mockTx = {
    shop: { findUnique: vi.fn() },
    booking: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    coupon: { create: vi.fn() },
    paymentLog: { findFirst: vi.fn() },
    bookingSeal: { findMany: vi.fn() },
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockTx,
    mockRefundPayment,
    mockSealService: {
      applyCheckInWithinTx: vi.fn().mockResolvedValue(true),
      applyCheckOutReturnSealsWithinTx: vi.fn().mockResolvedValue(true),
    },
    mockPrisma: {
      $transaction: vi.fn(
        async (fn: (tx: typeof mockTx) => Promise<any>) => fn(mockTx)
      ),
      ...mockTx,
    },
  };
});

vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: mockGetPricingRules,
  getPricingRulesCached: mockGetPricingRules,
}));

vi.mock("@/lib/db", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/qr-token", () => ({
  createQrToken: vi.fn().mockResolvedValue("signed-jwt-token"),
  verifyQrToken: vi.fn().mockResolvedValue({ bookingId: "b1" }),
}));

vi.mock("@/services/PaymentService", () => ({
  paymentService: {
    refundPayment: (...args: any[]) => mockRefundPayment(...args),
  },
}));

vi.mock("@/services/SealService", () => ({
  sealService: mockSealService,
}));

vi.mock("@/lib/shop-hours", () => ({
  isShopOpenAt: vi.fn().mockReturnValue(true),
}));

describe("BookingService Deep Logic", () => {
  const service = new BookingService();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isShopOpenAt).mockReturnValue(true);
    mockPrisma.booking.findUnique.mockResolvedValue({ id: "b1", shop: { openingTime: "09:00", closingTime: "18:00" } } as any);
  });

  describe("checkIn", () => {
    it("should fail if shop is closed", async () => {
      vi.mocked(isShopOpenAt).mockReturnValue(false);
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "PAID",
        shop: { id: "s1", openingTime: "09:00", closingTime: "18:00" },
      } as any);

      const result = await service.checkIn("b1", "photo.jpg", { sealAssignments: [], faultySealNumbers: [] });
      
      expect(result.ok).toBe(false);
      expect((result as any).code).toBe("SHOP_CLOSED");
    });

    it("should fail if seal count mismatch", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "PAID",
        bagCountS: 2, // 2 bags
        bagCountM: 0,
        bagCountXl: 0,
        shop: { id: "s1" },
      } as any);

      const result = await service.checkIn("b1", "photo.jpg", { 
        sealAssignments: [{ sealNumber: 1, bagIndex: 0, bagSize: "S" }], // Only 1 seal
        faultySealNumbers: [] 
      });

      expect(result.ok).toBe(false);
      expect((result as any).code).toBe("SEAL_COUNT_MISMATCH");
    });

    it("should succeed and update status to CHECKED_IN", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "PAID",
        bagCountS: 1,
        bagCountM: 0,
        bagCountXl: 0,
        shop: { id: "s1" },
      } as any);

      const result = await service.checkIn("b1", "photo.jpg", { 
        sealAssignments: [{ sealNumber: 1, bagIndex: 0, bagSize: "S" }],
        faultySealNumbers: [] 
      });

      expect(result.ok).toBe(true);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "CHECKED_IN" }),
      }));
    });
  });

  describe("checkOut", () => {
    it("should apply late fee if picked up after grace period", async () => {
      const scheduledCheckOut = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "CHECKED_IN",
        checkOutTime: scheduledCheckOut,
      } as any);

      const result = await service.checkOut("b1");

      expect(result.ok).toBe(true);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          lateFeeApplied: expect.objectContaining({ d: expect.any(Array) }), // Prisma Decimal mock
        }),
      }));
    });

    it("should trigger refund if checked out early", async () => {
      // Future checkout scheduled
      const scheduledCheckOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); 
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "CHECKED_IN",
        checkInTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        checkOutTime: scheduledCheckOut,
        totalPrice: 200,
        unitPrice: 50,
        bagCountS: 1, bagCountM: 0, bagCountXl: 0,
      } as any);

      mockRefundPayment.mockResolvedValue({ status: "success" });

      await service.checkOut("b1");

      expect(mockRefundPayment).toHaveBeenCalled();
    });
  });

  describe("modifyBooking", () => {
    it("should prevent price increase for PAID bookings", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "PAID",
        guestId: "g1",
        totalPrice: 100,
        bagCountS: 1, bagCountM: 0, bagCountXl: 0,
        shop: { pricePerDay: 50 },
      } as any);

      const result = await service.modifyBooking("b1", "g1", {
        checkInTime: new Date(),
        checkOutTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // More days -> higher price
        bagCountS: 2,
        bagCountM: 0,
        bagCountXl: 0,
      });

      expect(result.ok).toBe(false);
      expect((result as any).code).toBe("PRICE_INCREASE");
    });
  });
});
