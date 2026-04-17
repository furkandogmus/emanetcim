/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentService } from "../services/PaymentService";

const { mockPrisma, mockNotification, mockFeatureFlags } = vi.hoisted(() => {
  return {
    mockPrisma: {
      booking: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
      },
      paymentLog: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn((fn) => {
        if (typeof fn === 'function') return fn(mockPrisma);
        return Promise.all(fn);
      }),
    },
    mockNotification: {
      notifyBookingSuccess: vi.fn().mockResolvedValue(true),
      notifyPartnerAndAdminsForNewPaidBooking: vi.fn().mockResolvedValue(true),
    },
    mockFeatureFlags: {
      isPaymentsEnabled: vi.fn().mockResolvedValue(true),
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/NotificationService", () => ({ notificationService: mockNotification }));
vi.mock("@/lib/feature-flags", () => ({ isPaymentsEnabled: mockFeatureFlags.isPaymentsEnabled }));
vi.mock("@/lib/iyzipay", () => ({
  iyzipay: {
    payment: { create: vi.fn() },
    refund: { create: vi.fn() },
  },
  assertIyzicoKeys: vi.fn(),
}));
vi.mock("@/lib/metrics", () => ({ recordMetric: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PaymentService Deep Logic", () => {
  let service: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
    mockFeatureFlags.isPaymentsEnabled.mockResolvedValue(true);
  });

  describe("processWebhook (iyzico)", () => {
    it("should update booking to PAID and notify when payment is success", async () => {
      const bookingId = "b1";
      const paymentId = "iyz_123";

      mockPrisma.booking.findUnique.mockResolvedValue({
        id: bookingId,
        status: "PENDING",
        totalPrice: 100,
        guest: { email: "guest@test.com" },
        shop: { name: "Shop", owner: { phone: "555" } },
      });

      const result = await service.processWebhook({
        status: "success",
        paymentId,
        conversationId: bookingId,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: bookingId },
        data: { status: "PAID" },
      }));
      expect(mockNotification.notifyBookingSuccess).toHaveBeenCalled();
    });

    it("should ignore webhook if status is not success", async () => {
      const result = await service.processWebhook({
        status: "failure",
        paymentId: "123",
        conversationId: "b1",
      });
      expect(result.success).toBe(false);
      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });
  });

  describe("reconcileStalePaymentBookings", () => {
    it("should fix bookings that are PAID in logs but PENDING in booking table", async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: "stuck1", totalPrice: 50, guest: {}, shop: {} },
        { id: "stuck2", totalPrice: 50, guest: {}, shop: {} },
      ]);

      const result = await service.reconcileStalePaymentBookings();

      expect(result.fixed).toBe(2);
      expect(mockPrisma.booking.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: "PAID" },
      }));
    });
  });

  describe("refundPayment", () => {
    it("should fail if payments are disabled", async () => {
      mockFeatureFlags.isPaymentsEnabled.mockResolvedValue(false);
      const result = await service.refundPayment("b1", 50);
      expect(result.status).toBe("failure");
    });

    it("should correctly handle Stripe simulation in dev mode", async () => {
      // simulate dev mode
      (process.env as any).NODE_ENV = "development";
      
      mockPrisma.paymentLog.findFirst.mockResolvedValue({
        id: "log1",
        transactionId: "pi_dev_123", // Stripe dev prefix
      });

      const result = await service.refundPayment("b1", 50);

      expect(result.status).toBe("success");
      expect(mockPrisma.paymentLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: "REFUNDED" },
      }));
    });
  });
});
