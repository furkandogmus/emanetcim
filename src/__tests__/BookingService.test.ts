import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "../services/BookingService";
import prisma from "@/lib/db";

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

  it("cancelBooking: PAID refund success then CANCELLED", async () => {
    vi.mocked(mockTx.booking.findUnique).mockResolvedValue({
      id: "b2",
      status: "PAID",
      totalPrice: 100,
      insuranceFee: 15,
    } as never);
    mockRefundPayment.mockResolvedValue({ status: "success" });
    vi.mocked(mockTx.booking.update).mockResolvedValue({} as never);

    const r = await service.cancelBooking("b2");
    expect(r).toEqual({ ok: true });
    expect(mockRefundPayment).toHaveBeenCalled();
    expect(mockTx.booking.update).toHaveBeenCalled();
  });

  it("cancelBooking: PAID refund failure does not cancel", async () => {
    vi.mocked(mockTx.booking.findUnique).mockResolvedValue({
      id: "b3",
      status: "PAID",
      totalPrice: 100,
      insuranceFee: 15,
    } as never);
    mockRefundPayment.mockResolvedValue({ status: "failure" });

    const r = await service.cancelBooking("b3");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("REFUND_FAILED");
    expect(mockRefundPayment).toHaveBeenCalled();
    expect(mockTx.booking.update).not.toHaveBeenCalled();
  });
});
