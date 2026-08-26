/* eslint-disable @typescript-eslint/no-explicit-any */
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
        updateMany: vi.fn(),
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
      approveBooking: vi.fn(),
      rejectBooking: vi.fn(),
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
    mockPrisma.coupon.updateMany.mockResolvedValue({ count: 1 });

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
      couponCode: "TEST10",
    });

    expect(mockPrisma.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "coupon-1", usedCount: { lt: 1 } },
      data: { usedCount: { increment: 1 } },
    });
  });

  it("does not discount the booking when the quota claim loses the race (BULGU 9.1)", async () => {
    // bkz. docs/KOD_TARAMA_2026-08-23.md: kota kontrolü artık booking oluşmadan ÖNCE,
    // atomik `updateMany` ile yapılıyor. Kota doluysa (count: 0) indirim hiç
    // uygulanmamalı — booking, kuponsuz haliyle aynı tam fiyattan oluşmalı.
    mockAuth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
    mockPrisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      isActive: true,
      pricePerDay: 50,
      owner: { phone: "555" },
    });
    mockBookingService.createInitialBooking.mockResolvedValue({
      id: "b1",
      qrCodeToken: "tok",
    });
    mockPrisma.booking.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { createBookingAction } = await import("@/actions/booking");
    const checkIn = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const checkOut = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const baseInput = {
      shopId: "shop-1",
      bagCountS: 1,
      bagCountM: 0,
      bagCountXl: 0,
      unitPrice: 50,
      totalPrice: 50,
      checkInTime: checkIn,
      checkOutTime: checkOut,
    };

    // 1) Kuponsuz referans fiyat
    await createBookingAction(baseInput);
    const baselineTotalPrice =
      mockBookingService.createInitialBooking.mock.calls[0][0].totalPrice;

    // 2) Aynı fiyat, ama kupon kotası yarışı kaybetmiş (count: 0) gibi kur
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: "coupon-1",
      code: "TEST10",
      isActive: true,
      expiresAt: null,
      maxUses: 1,
      usedCount: 0, // eski (stale) okuma hâlâ kota var gibi görünüyor
      isPercent: false,
      discount: 10,
      minPrice: null,
    });
    mockPrisma.coupon.updateMany.mockResolvedValue({ count: 0 }); // yarışı kaybetti

    await createBookingAction({ ...baseInput, couponCode: "TEST10" });

    expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
    expect(mockBookingService.createInitialBooking).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalPrice: baselineTotalPrice }),
    );
  });
});

describe("Audit Fix #2: rejectBookingAction Status Guard", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * Durum korumasi 2026-08-25'te SERVISE tasindi
   * (`src/services/booking/partner-review.ts`): ayni kural web action'inda ve
   * mobil ucta iki kez yaziliydi ve mobil kopya iadeyi/slot temizligini
   * atliyordu. Kuralin KENDISI artik `PartnerReview.test.ts`'te sinaniyor;
   * burada action'in ham prisma yazmadigi ve sonucu dogru cevirdigi kaliyor.
   */
  it("durum çakışmasını kullanıcıya çeviri anahtarı olarak döner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1", role: "PARTNER" } });
    mockBookingService.rejectBooking.mockResolvedValue({ ok: false, code: "INVALID_STATUS" });

    const { rejectBookingAction } = await import("@/actions/partner");
    const result = await rejectBookingAction("b1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Errors.bookingStateConflict");
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("reddi ham prisma yerine servise devreder", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1", role: "PARTNER" } });
    mockBookingService.rejectBooking.mockResolvedValue({ ok: true });

    const { rejectBookingAction } = await import("@/actions/partner");
    const result = await rejectBookingAction("b2");

    expect(result.success).toBe(true);
    expect(mockBookingService.rejectBooking).toHaveBeenCalledWith(
      "b2",
      { id: "owner-1", role: "PARTNER" },
      expect.objectContaining({ locale: expect.any(String) }),
    );
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
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

  it("ignores client-supplied shopId and reviews the booking's real shop", async () => {
    // bkz. docs/KOD_TARAMA_2026-08-23.md, BULGU 10.1: istemci `shopId`'yi başka bir
    // dükkana ayarlayıp o dükkana sahte yorum bırakabiliyordu.
    mockAuth.mockResolvedValue({ user: { id: "guest-1" } });
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      guestId: "guest-1",
      shopId: "real-shop",
      status: "CHECKED_OUT",
    });
    const { reviewService } = await import("@/services/ReviewService");

    const { addReviewAction } = await import("@/actions/review");
    const result = await addReviewAction({
      bookingId: "b1",
      guestId: "guest-1",
      shopId: "attacker-controlled-shop",
      rating: 1,
    });

    expect(result.success).toBe(true);
    expect(reviewService.addReview).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: "real-shop" }),
    );
  });
});
