import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "../services/BookingService";
import prisma from "@/lib/db";

const { mockTx, mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    shop: { findUnique: vi.fn() },
    booking: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockTx,
    mockPrisma: {
      $transaction: vi.fn(
        async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
      ),
      ...mockTx,
    },
  };
});

vi.mock("@/lib/db", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/qr-token", () => ({
  createQrToken: vi.fn().mockResolvedValue("signed-jwt-token"),
}));

describe("BookingService", () => {
  const service = new BookingService();

  beforeEach(() => {
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
});
