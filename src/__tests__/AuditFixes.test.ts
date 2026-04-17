/**
 * Deep Audit Fix Verification Tests
 * Tests for all 5 bugs found during the deep system audit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== MOCKS ====================

const { mockPrisma, mockAuth, mockBookingService, mockSealService } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: { findUnique: vi.fn() },
      booking: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      coupon: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      review: { create: vi.fn() },
      user: { findUnique: vi.fn() },
      $transaction: vi.fn((fn: any) => {
        if (typeof fn === "function") return fn(mockPrisma);
        return Promise.all(fn);
      }),
    },
    mockAuth: vi.fn(),
    mockBookingService: {
      createInitialBooking: vi.fn(),
      getBookingDetails: vi.fn(),
      cancelBooking: vi.fn(),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
      modifyBooking: vi.fn(),
    },
    mockSealService: {
      getNextAvailableSeals: vi.fn(),
      markSealAsFaulty: vi.fn(),
    },
  };
});

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/BookingService", () => ({
  bookingService: mockBookingService,
  BookingCapacityExceededError: class extends Error { name = "BookingCapacityExceededError"; },
}));
vi.mock("@/services/SealService", () => ({ sealService: mockSealService }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyPartnerAndAdminsForNewPaidBooking: vi.fn().mockResolvedValue(true),
    notifyGuestBookingRequestSms: vi.fn().mockResolvedValue(true),
    notifyBookingCancelled: vi.fn().mockResolvedValue(true),
    notifyBookingApproved: vi.fn().mockResolvedValue(true),
    notifyCheckIn: vi.fn().mockResolvedValue(true),
    notifyCheckOut: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/qr-token", () => ({
  verifyQrToken: vi.fn().mockResolvedValue(null),
  createQrToken: vi.fn().mockResolvedValue("token"),
}));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn().mockResolvedValue({
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
vi.mock("@/lib/money", () => ({ moneyToNumber: (v: any) => Number(v) || 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: () => "127.0.0.1",
  }),
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("tr"),
}));
vi.mock("@/services/ReviewService", () => ({
  reviewService: { addReview: vi.fn().mockResolvedValue({ id: "r1" }) },
}));

// ==================== TESTS ====================

describe("Audit Fix #1: Coupon usedCount Increment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should increment coupon usedCount after successful booking", async () => {
    mockAuth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
    mockPrisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      isActive: true,
      pricePerDay: 50,
      owner: { phone: "555" },
    });
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: "coupon-1",
      code: "TEST10",
      isActive: true,
      expiresAt: null,
      maxUses: 1,
      usedCount: 0,
      isPercent: false,
      discount: 10,
      minPrice: null,
    });
    mockBookingService.createInitialBooking.mockResolvedValue({
      id: "b1",
      qrCodeToken: "tok",
    });
    mockPrisma.booking.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.coupon.update.mockResolvedValue({});

    const { createBookingAction } = await import("@/actions/booking");
    const checkIn = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const checkOut = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await createBookingAction({
      shopId: "shop-1",
      bagCountS: 1,
      bagCountM: 0,
      bagCountXl: 0,
      unitPrice: 50,
      totalPrice: 50,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      cardInfo: { cardHolderName: "Test", cardNumber: "1234", expireMonth: "01", expireYear: "2030", cvc: "123" },
      couponCode: "TEST10",
    });

    expect(mockPrisma.coupon.update).toHaveBeenCalledWith({
      where: { id: "coupon-1" },
      data: { usedCount: { increment: 1 } },
    });
  });
});

describe("Audit Fix #2: rejectBookingAction Status Guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should reject PAID booking request with error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1", role: "PARTNER" } });
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "PAID",
      shop: { ownerId: "owner-1" },
      guest: { email: "g@t.com" },
    });

    const { rejectBookingAction } = await import("@/actions/partner");
    const result = await rejectBookingAction("b1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Errors.bookingStateConflict");
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
  });

  it("should allow rejecting WAITING_APPROVAL booking", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1", role: "PARTNER" } });
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: "b2",
      status: "WAITING_APPROVAL",
      shop: { ownerId: "owner-1" },
      guest: { email: "g@t.com" },
    });
    mockPrisma.booking.update.mockResolvedValue({});

    const { rejectBookingAction } = await import("@/actions/partner");
    const result = await rejectBookingAction("b2");

    expect(result.success).toBe(true);
    expect(mockPrisma.booking.update).toHaveBeenCalled();
  });
});

describe("Audit Fix #3: Zero-Bag Booking Prevention", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should reject booking with all bag counts = 0", async () => {
    mockAuth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
    mockPrisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      isActive: true,
      pricePerDay: 50,
      owner: { phone: "555" },
    });

    const { createBookingAction } = await import("@/actions/booking");
    const checkIn = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const checkOut = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const result = await createBookingAction({
      shopId: "shop-1",
      bagCountS: 0,
      bagCountM: 0,
      bagCountXl: 0,
      unitPrice: 50,
      totalPrice: 0,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      cardInfo: { cardHolderName: "Test", cardNumber: "1234", expireMonth: "01", expireYear: "2030", cvc: "123" },
    });

    expect(result.success).toBe(false);
    expect(mockBookingService.createInitialBooking).not.toHaveBeenCalled();
  });
});

describe("Audit Fix #4: Seal Action Ownership Check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should block partner from accessing another shop's seals", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-A", role: "PARTNER" } });
    mockPrisma.shop.findUnique.mockResolvedValue({
      ownerId: "owner-B", // Different owner
    });

    const { getNextAvailableSealsAction } = await import("@/actions/partner");
    const result = await getNextAvailableSealsAction("shop-B", 5);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Errors.unauthorized");
    expect(mockSealService.getNextAvailableSeals).not.toHaveBeenCalled();
  });

  it("should allow partner to access own shop's seals", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-A", role: "PARTNER" } });
    mockPrisma.shop.findUnique.mockResolvedValue({
      ownerId: "owner-A", // Same owner
    });
    mockSealService.getNextAvailableSeals.mockResolvedValue([
      { serialNumber: 1001 },
    ]);

    const { getNextAvailableSealsAction } = await import("@/actions/partner");
    const result = await getNextAvailableSealsAction("shop-A", 1);

    expect(result.success).toBe(true);
  });
});

describe("Audit Fix #5: Review Rating Integer Check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should reject fractional rating (3.7)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "guest-1" } });

    const { addReviewAction } = await import("@/actions/review");
    const result = await addReviewAction({
      bookingId: "b1",
      guestId: "guest-1",
      shopId: "s1",
      rating: 3.7,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Errors.invalidData");
  });

  it("should accept valid integer rating (4)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "guest-1" } });
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      guestId: "guest-1",
      status: "CHECKED_OUT",
    });

    const { addReviewAction } = await import("@/actions/review");
    const result = await addReviewAction({
      bookingId: "b1",
      guestId: "guest-1",
      shopId: "s1",
      rating: 4,
    });

    expect(result.success).toBe(true);
  });
});
