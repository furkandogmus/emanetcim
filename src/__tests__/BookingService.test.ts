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

const { mockTx, mockPrisma, mockSealService, mockPaymentService } = vi.hoisted(() => {
  const mockPaymentService = {
    capabilities: { id: "manual", capturesOnline: false, supportsCardRefund: false, supportsSplit: false },
    hasCapturedPayment: vi.fn().mockResolvedValue(false),
    openIntent: vi.fn().mockResolvedValue({ ok: true, value: { redirectUrl: null, status: "PENDING" } }),
    markCaptured: vi.fn().mockResolvedValue({ ok: true, value: { transactionId: "t1" } }),
    refund: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    cancelIntent: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
  const mockTx = {
    shop: { findUnique: vi.fn() },
    booking: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    coupon: { create: vi.fn() },
    paymentLog: { findFirst: vi.fn() },
    bookingSeal: { findMany: vi.fn() },
    bookingEvent: { create: vi.fn(), findMany: vi.fn() },
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockTx,
    mockPaymentService,
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

vi.mock("@/services/SealService", () => ({
  sealService: mockSealService,
}));

vi.mock("@/lib/shop-hours", () => ({
  isShopOpenAt: vi.fn().mockReturnValue(true),
}));

/**
 * Ödeme defteri. Varsayılan: tahsilat YOK ve sağlayıcı online tahsil ETMİYOR
 * (lansmandaki `manual`), yani check-in tahsilatı kendisi yapar (P1-9).
 */
vi.mock("@/services/PaymentService", () => ({
  paymentService: mockPaymentService,
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

      const result = await service.checkIn("b1");
      
      expect(result.ok).toBe(false);
      expect((result as any).code).toBe("SHOP_CLOSED");
    });

    it("should succeed and update status to CHECKED_IN", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "PAID",
        bagCountS: 1,
        bagCountM: 0,
        bagCountXl: 0,
        totalPrice: 100,
        bookingRowVersion: 0,
        shop: { id: "s1" },
      } as any);

      const result = await service.checkIn("b1");

      expect(result.ok).toBe(true);
      expect(mockTx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "CHECKED_IN" }),
      }));
    });

    /**
     * P1-9: prod'da 7 rezervasyon ödeme kaydı olmadan ilerlemişti, ikisinde bavul
     * zaten dükkana teslim edilmişti. Kural yoktu.
     */
    describe("ödeme kanıtı (P1-9)", () => {
      const paidBooking = {
        id: "b1",
        status: "PAID",
        bagCountS: 1,
        bagCountM: 0,
        bagCountXl: 0,
        totalPrice: 100,
        bookingRowVersion: 0,
        shop: { id: "s1" },
      };

      it("dükkanda tahsilat modunda check-in TAHSİLATI KENDİSİ yapar", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(paidBooking as any);
        mockPaymentService.hasCapturedPayment.mockResolvedValue(false);

        const result = await service.checkIn("b1");

        expect(result.ok).toBe(true);
        expect(mockPaymentService.openIntent).toHaveBeenCalledWith(
          expect.objectContaining({ bookingId: "b1", amount: 100 }),
        );
        expect(mockPaymentService.markCaptured).toHaveBeenCalled();
      });

      it("tahsilat zaten yapılmışsa ikinci kez yapılmaz", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(paidBooking as any);
        mockPaymentService.hasCapturedPayment.mockResolvedValue(true);

        const result = await service.checkIn("b1");

        expect(result.ok).toBe(true);
        expect(mockPaymentService.openIntent).not.toHaveBeenCalled();
        expect(mockPaymentService.markCaptured).not.toHaveBeenCalled();
      });

      it("ONLINE tahsil eden sağlayıcıda ödemesiz check-in REDDEDİLİR", async () => {
        // Misafir ödemeden bavul birakamaz.
        mockPrisma.booking.findUnique.mockResolvedValue(paidBooking as any);
        mockPaymentService.hasCapturedPayment.mockResolvedValue(false);
        mockPaymentService.capabilities.capturesOnline = true;

        const result = await service.checkIn("b1");

        expect(result.ok).toBe(false);
        expect((result as any).code).toBe("PAYMENT_REQUIRED");
        expect(mockTx.booking.updateMany).not.toHaveBeenCalled();

        mockPaymentService.capabilities.capturesOnline = false;
      });

      it("tahsilat kaydedilemezse BAVUL KABUL EDİLMEZ", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(paidBooking as any);
        mockPaymentService.hasCapturedPayment.mockResolvedValue(false);
        mockPaymentService.markCaptured.mockResolvedValueOnce({
          ok: false,
          code: "NO_INTENT",
          message: "x",
        });

        const result = await service.checkIn("b1");

        expect(result.ok).toBe(false);
        expect((result as any).code).toBe("PAYMENT_REQUIRED");
        expect(mockTx.booking.updateMany).not.toHaveBeenCalled();
      });

      it("SIRA: tahsilat check-in'DEN ÖNCE — ters sıra P1-9'u yeniden üretirdi", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(paidBooking as any);
        mockPaymentService.hasCapturedPayment.mockResolvedValue(false);

        const order: string[] = [];
        mockPaymentService.markCaptured.mockImplementationOnce(async () => {
          order.push("capture");
          return { ok: true, value: { transactionId: "t1" } };
        });
        mockTx.booking.updateMany.mockImplementationOnce(async () => {
          order.push("checkin");
          return { count: 1 };
        });

        await service.checkIn("b1");

        expect(order).toEqual(["capture", "checkin"]);
      });
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
      expect(mockTx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          lateFeeApplied: expect.objectContaining({ d: expect.any(Array) }), // Prisma Decimal mock
        }),
      }));
    });

    it("should track manual refund amount if checked out early", async () => {
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

      await service.checkOut("b1");

      expect(mockTx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          failedRefundAmount: expect.anything(),
        }),
      }));
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
