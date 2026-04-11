import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "../services/BookingService";

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

const { mockTx, mockPrisma, mockRefundPayment } = vi.hoisted(() => {
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
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockTx,
    mockRefundPayment,
    mockPrisma: {
      $transaction: vi.fn(
        async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
      ),
      ...mockTx,
    },
  };
});

vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: mockGetPricingRules,
}));

vi.mock("@/lib/db", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/qr-token", () => ({
  createQrToken: vi.fn().mockResolvedValue("signed-jwt-token"),
}));

vi.mock("@/services/PaymentService", () => ({
  paymentService: {
    refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
    reconcileStalePaymentBookings: vi.fn().mockResolvedValue({ fixed: 0, bookingIds: [] }),
  },
}));

describe("BookingService", () => {
  const service = new BookingService();

  beforeEach(() => {
    vi.mocked(mockRefundPayment).mockReset();
    vi.mocked(mockTx.booking.update).mockClear();
    vi.mocked(mockTx.booking.findUnique).mockReset();
    vi.mocked(mockTx.paymentLog.findFirst).mockResolvedValue(null);
    vi.mocked(mockTx.coupon.create).mockReset();
    vi.mocked(mockTx.shop.findUnique).mockResolvedValue({
      id: "shop-1",
      pricePerDay: 50,
      capacity: 100,
    } as never);
    vi.mocked(mockTx.booking.findMany).mockResolvedValue([]);
    vi.mocked(mockTx.booking.create).mockResolvedValue({
      id: "booking-123",
      guestId: "guest-1",
      shopId: "shop-1",
      qrCodeToken: "temp_x",
      status: "PENDING",
    } as never);
    vi.mocked(mockTx.booking.update).mockResolvedValue({
      id: "booking-123",
      qrCodeToken: "signed-jwt-token",
    } as never);
  });

  it("should create a booking with signed QR token", async () => {
    const result = await service.createInitialBooking({
      guestId: "guest-1",
      shopId: "shop-1",
      totalPrice: 100,
      bagCountS: 1,
      bagCountM: 0,
      bagCountXl: 0,
      checkInTime: new Date(),
      checkOutTime: new Date(),
    });

    expect(result.qrCodeToken).toBe("signed-jwt-token");
    expect(mockTx.booking.create).toHaveBeenCalled();
    expect(mockTx.booking.update).toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("cancelBooking: PENDING updates to CANCELLED", async () => {
    vi.mocked(mockTx.booking.findUnique).mockResolvedValue({
      id: "b1",
      status: "PENDING",
      totalPrice: 100,
      insuranceFee: 15,
      checkInTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    } as never);
    vi.mocked(mockTx.booking.update).mockResolvedValue({} as never);

    const r = await service.cancelBooking("b1");
    expect(r).toEqual({ ok: true });
    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { status: "CANCELLED" },
    });
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("cancelBooking: PAID refund success then CANCELLED (≥24h → full)", async () => {
    vi.mocked(mockTx.booking.findUnique).mockResolvedValue({
      id: "b2",
      status: "PAID",
      totalPrice: 100,
      insuranceFee: 15,
      checkInTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    } as never);
    vi.mocked(mockTx.paymentLog.findFirst).mockResolvedValue({
      id: "pl1",
      status: "SUCCESS",
    } as never);
    mockRefundPayment.mockResolvedValue({ status: "success" });
    vi.mocked(mockTx.booking.update).mockResolvedValue({} as never);

    const r = await service.cancelBooking("b2");
    expect(r).toEqual({ ok: true, creditCode: undefined });
    expect(mockRefundPayment).toHaveBeenCalledWith("b2", 100, undefined);
    expect(mockTx.booking.update).toHaveBeenCalled();
  });

  it("cancelBooking: PAID partial tier (1–24h) refunds 50%", async () => {
    vi.mocked(mockTx.booking.findUnique).mockResolvedValue({
      id: "b2p",
      status: "PAID",
      totalPrice: 100,
      insuranceFee: 15,
      checkInTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
    } as never);
    vi.mocked(mockTx.paymentLog.findFirst).mockResolvedValue({
      id: "pl1",
      status: "SUCCESS",
    } as never);
    mockRefundPayment.mockResolvedValue({ status: "success" });
    vi.mocked(mockTx.booking.update).mockResolvedValue({} as never);

    const r = await service.cancelBooking("b2p");
    expect(r).toEqual({ ok: true, creditCode: undefined });
    expect(mockRefundPayment).toHaveBeenCalledWith("b2p", 50, {
      keepPaymentLogSuccess: true,
    });
  });

  it("cancelBooking: PAID credit tier (<1h) creates coupon, no card refund", async () => {
    vi.mocked(mockTx.booking.findUnique).mockResolvedValue({
      id: "b2c",
      status: "PAID",
      totalPrice: 100,
      insuranceFee: 15,
      checkInTime: new Date(Date.now() + 30 * 60 * 1000),
    } as never);
    vi.mocked(mockTx.paymentLog.findFirst).mockResolvedValue({
      id: "pl1",
      status: "SUCCESS",
    } as never);
    vi.mocked(mockTx.coupon.create).mockResolvedValue({ code: "EMTEST" } as never);
    vi.mocked(mockTx.booking.update).mockResolvedValue({} as never);

    const r = await service.cancelBooking("b2c");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.creditCode).toBeDefined();
      expect(r.creditCode).toMatch(/^EM[A-Z0-9]+$/);
    }
    expect(mockRefundPayment).not.toHaveBeenCalled();
    expect(mockTx.coupon.create).toHaveBeenCalled();
  });

  it("cancelBooking: PAID refund failure does not cancel", async () => {
    vi.mocked(mockTx.booking.findUnique).mockResolvedValue({
      id: "b3",
      status: "PAID",
      totalPrice: 100,
      insuranceFee: 15,
      checkInTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    } as never);
    vi.mocked(mockTx.paymentLog.findFirst).mockResolvedValue({
      id: "pl1",
      status: "SUCCESS",
    } as never);
    mockRefundPayment.mockResolvedValue({ status: "failure" });

    const r = await service.cancelBooking("b3");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("REFUND_FAILED");
    expect(mockRefundPayment).toHaveBeenCalled();
    expect(mockTx.booking.update).not.toHaveBeenCalled();
  });
});
