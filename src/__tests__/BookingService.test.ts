/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "../services/BookingService";
import { isShopOpenAt, isShopOpenForHandover } from "@/lib/shop-hours";

/**
 * `vi.clearAllMocks()` çağrıları temizler ama `mockResolvedValue` ile verilen
 * GERÇEKLEŞTİRİMİ temizlemez. Bir testin kurduğu kural seti, aksi belirtilmezse
 * dosyanın geri kalanına sızar. Bu yüzden temel kural seti tek yerde durur ve
 * her testten önce geri yüklenir.
 */
const { mockGetPricingRules, BASE_PRICING_RULES } = vi.hoisted(() => {
  const BASE_PRICING_RULES = {
    maxStayDays: 30,
    maxBagsPerSlot: 50,
    insuranceFeeTry: 15,
    earlyRefundRatio: 0.9,
    cancelFixedFeeTry: 20,
    defaultShopCapacity: 10,
    defaultPricePerDay: 50,
    bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
    platformHolidayDates: [],
    requireSealsOnCheckIn: false,
  };
  return {
    BASE_PRICING_RULES,
    mockGetPricingRules: vi.fn().mockResolvedValue(BASE_PRICING_RULES),
  };
});

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

/*
  `isShopOpenForHandover`, check-in kapisinin ARTIK cagirdigi fonksiyon:
  `isShopOpenAt`ten farki `open247`yi ve dukkanin saat dilimini de hesaba
  katmasi (bkz. `checkin-shop-hours.test.ts`). Mock'ta ikisi de duruyor cunku
  modul tamamen degistiriliyor -- eksik birakilan her disa aktarim `undefined`
  olur ve testler sebebi gorunmeyen bicimde kirilir.
*/
vi.mock("@/lib/shop-hours", () => ({
  isShopOpenAt: vi.fn().mockReturnValue(true),
  isShopOpenForHandover: vi.fn().mockReturnValue(true),
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
    mockGetPricingRules.mockResolvedValue(BASE_PRICING_RULES);
    vi.mocked(isShopOpenAt).mockReturnValue(true);
    vi.mocked(isShopOpenForHandover).mockReturnValue(true);
    mockPrisma.booking.findUnique.mockResolvedValue({ id: "b1", shop: { openingTime: "09:00", closingTime: "18:00" } } as any);
  });

  describe("checkIn", () => {
    it("should fail if shop is closed", async () => {
      vi.mocked(isShopOpenForHandover).mockReturnValue(false);
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

    /**
     * P1-23: `BookingSeal` prod'da TAMAMEN BOŞTU, buna karşılık 3 `CHECKED_IN`
     * rezervasyon vardı. Üç bavul dükkanda, hangi mühürle mühürlendikleri
     * hiçbir yerde yok — mührün kanıt zinciri hiç kurulmamıştı.
     */
    describe("mühür kaydı (P1-23)", () => {
      const paidBooking = {
        id: "b1",
        status: "PAID",
        shopId: "s1",
        bagCountS: 1,
        bagCountM: 1,
        bagCountXl: 0,
        totalPrice: 100,
        bookingRowVersion: 0,
        shop: { id: "s1" },
      };

      const assignments = [
        { sealNumber: 101, bagIndex: 0, bagSize: "S" },
        { sealNumber: 102, bagIndex: 1, bagSize: "M" },
      ];

      beforeEach(() => {
        mockPrisma.booking.findUnique.mockResolvedValue(paidBooking as any);
        mockGetPricingRules.mockResolvedValue({
          ...BASE_PRICING_RULES,
          requireSealsOnCheckIn: true,
        });
      });

      it("ayar AÇIKKEN mühürsüz check-in reddedilir", async () => {
        const result = await service.checkIn("b1");

        expect(result.ok).toBe(false);
        expect((result as any).code).toBe("SEAL_REQUIRED");
        expect(mockTx.booking.updateMany).not.toHaveBeenCalled();
      });

      it("ayar AÇIKKEN valiz sayısıyla mühür sayısı eşleşmezse reddedilir", async () => {
        const result = await service.checkIn("b1", {
          sealAssignments: [assignments[0]] as any,
          faultySealNumbers: [],
        });

        expect(result.ok).toBe(false);
        expect((result as any).code).toBe("SEAL_COUNT_MISMATCH");
        expect(mockTx.booking.updateMany).not.toHaveBeenCalled();
      });

      it("ayar KAPALIYKEN mühürsüz check-in geçer — lansman esnafı bloke edilmez", async () => {
        mockGetPricingRules.mockResolvedValue(BASE_PRICING_RULES);

        const result = await service.checkIn("b1");

        expect(result.ok).toBe(true);
      });

      /**
       * Satır içi `bookingSeal.create` döngüsü doğrulamanın tamamını atlıyordu:
       * başka dükkanın mührü ya da zaten `IN_USE` bir mühür kabul ediliyordu.
       * Yazım `SealService`'ten GEÇMEK ZORUNDA.
       */
      it("mühür yazımı SealService üzerinden yapılır — satır içi create YOK", async () => {
        const result = await service.checkIn("b1", {
          sealAssignments: assignments as any,
          faultySealNumbers: [],
        });

        expect(result.ok).toBe(true);
        expect(mockSealService.applyCheckInWithinTx).toHaveBeenCalledWith(
          mockTx,
          expect.objectContaining({
            shopId: "s1",
            bookingId: "b1",
            assignments,
            faultySealNumbers: [],
          }),
        );
      });

      it("SealService mührü reddederse check-in TAMAMEN geri alınır", async () => {
        mockSealService.applyCheckInWithinTx.mockRejectedValueOnce(
          new Error("SEAL_NOT_ASSIGNED:101"),
        );

        const result = await service.checkIn("b1", {
          sealAssignments: assignments as any,
          faultySealNumbers: [],
        });

        expect(result.ok).toBe(false);
        expect((result as any).code).toBe("SEAL_NOT_ASSIGNED");
      });

      it("yalnızca BOZUK mühür bildirilse bile SealService çağrılır", async () => {
        mockGetPricingRules.mockResolvedValue(BASE_PRICING_RULES);

        const result = await service.checkIn("b1", {
          sealAssignments: [],
          faultySealNumbers: [999],
        });

        expect(result.ok).toBe(true);
        expect(mockSealService.applyCheckInWithinTx).toHaveBeenCalledWith(
          mockTx,
          expect.objectContaining({ faultySealNumbers: [999] }),
        );
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
