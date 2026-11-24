import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * MOBIL CHECKOUT TEKRAR-DENEME GUVENLI VE GOSTERILEN TUTARI DOGRULUYOR.
 *
 * 1. Istemci 12 sn'de istegi iptal edip ayni onayi yeniden gonderdiginde ilk
 *    istek sunucuda coktan yazilmis olabiliyordu: misafir cift rezervasyon.
 *    `Idempotency-Key` ayni (misafir, anahtar) icin mevcut rezervasyonu doner.
 * 2. Kupon/davet indirimi sessizce dusurulup tam fiyattan rezervasyon
 *    olusabiliyordu; istemci donen tutari hic karsilastirmiyordu. `expectedTotal`
 *    ayrisirsa 409 `price_changed` doner ve HICBIR SEY yazilmaz.
 */

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn().mockResolvedValue({ user: { id: "guest-1", email: null } }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/internal-api-guard", () => ({ clientIp: () => "127.0.0.1" }));
vi.mock("@/lib/db", () => ({
  default: {
    shop: {
      findUnique: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Dukkan",
        isActive: true,
        isTest: false,
        isPrelaunch: false,
        pricePerDay: 100,
        open247: true,
        openingTime: null,
        closingTime: null,
        timezone: "Europe/Istanbul",
        owner: { phone: null },
      }),
    },
  },
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/ShopScheduleService", () => ({
  loadScheduleParts: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/lib/stay-days", () => ({
  snapStayToShopHours: (_s: unknown, a: Date, b: Date) => ({ checkIn: a, checkOut: b }),
}));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/booking-server-price", () => ({
  bagCountsFitRules: () => true,
  computeAuthoritativeCheckoutTotals: () => ({
    subtotalBeforeCoupon: 300,
    unitPrice: 100,
    insuranceFee: 0,
    bagCountS: 1,
    bagCountM: 0,
    bagCountXl: 0,
  }),
}));
vi.mock("@/services/CouponService", () => ({
  couponService: { claim: mocks.claim, release: mocks.release },
}));
vi.mock("@/services/ReferralService", () => ({
  referralService: { resolveDiscount: vi.fn().mockResolvedValue(null) },
}));
vi.mock("@/services/BookingService", () => ({
  bookingService: {
    findBookingByIdempotencyKey: mocks.find,
    createInitialBooking: mocks.create,
  },
}));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyBookingSuccess: vi.fn().mockResolvedValue(undefined),
    notifyPartnerAndAdminsForNewPaidBooking: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/services/AnalyticsService", () => ({ analyticsService: { track: vi.fn() } }));

import { POST } from "@/app/api/mobile/checkout/intent/route";
import { BookingIdempotentReplayError } from "@/services/booking/errors";

const body = {
  shopId: "11111111-1111-4111-8111-111111111111",
  checkInTime: "2030-01-01T10:00:00.000Z",
  checkOutTime: "2030-01-03T10:00:00.000Z",
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
};

function req(extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/mobile/checkout/intent", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ ...body, ...extra }),
  });
}

const existing = {
  id: "b-1",
  status: "APPROVED",
  totalPrice: 300,
  checkInTime: new Date(body.checkInTime),
  checkOutTime: new Date(body.checkOutTime),
};

describe("POST /api/mobile/checkout/intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockResolvedValue(null);
  });

  it("ayni Idempotency-Key ikinci rezervasyon ACMAZ, mevcut olani doner", async () => {
    mocks.find.mockResolvedValue(existing);
    const res = await POST(req({}, { "idempotency-key": "attempt-0123456789" }));
    expect(res!.status).toBe(200);
    expect((await res!.json()).bookingId).toBe("b-1");
    expect(mocks.find).toHaveBeenCalledWith("guest-1", "attempt-0123456789");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("es zamanli tekrar: kazananin kaydi doner ve kupon hakki geri verilir", async () => {
    mocks.claim.mockResolvedValue({
      ok: true,
      claimed: { totalPrice: 270, couponId: "c-1", discountAmount: 30, code: "YAZ" },
    });
    mocks.create.mockRejectedValue(new BookingIdempotentReplayError(existing as never));
    const res = await POST(req({ couponCode: "YAZ" }, { "idempotency-key": "attempt-0123456789" }));
    expect(res!.status).toBe(200);
    expect((await res!.json()).bookingId).toBe("b-1");
    expect(mocks.release).toHaveBeenCalledWith("c-1");
  });

  it("gecersiz biçimli anahtar 400", async () => {
    const res = await POST(req({}, { "idempotency-key": "a b" }));
    expect(res!.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("kupon dusmus ve gosterilen tutar ayrisiyorsa 409 price_changed, rezervasyon yazilmaz", async () => {
    mocks.claim.mockResolvedValue({ ok: false });
    const res = await POST(req({ couponCode: "BITTI", expectedTotal: 270 }));
    expect(res!.status).toBe(409);
    expect(await res!.json()).toEqual({ error: "price_changed", totalPrice: 300 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("alinan kupon hakki, tutar ayrisinca geri verilir", async () => {
    mocks.claim.mockResolvedValue({
      ok: true,
      claimed: { totalPrice: 270, couponId: "c-1", discountAmount: 30, code: "YAZ" },
    });
    const res = await POST(req({ couponCode: "YAZ", expectedTotal: 250 }));
    expect(res!.status).toBe(409);
    expect(mocks.release).toHaveBeenCalledWith("c-1");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("tutar tutuyorsa rezervasyon yazilir ve anahtar servise gecer", async () => {
    mocks.create.mockResolvedValue({ ...existing, id: "b-2" });
    const res = await POST(req({ expectedTotal: 300 }, { "idempotency-key": "attempt-0123456789" }));
    expect(res!.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "attempt-0123456789", totalPrice: 300 }),
    );
  });

  it("expectedTotal gondermeyen eski istemci eskisi gibi calisir", async () => {
    mocks.create.mockResolvedValue({ ...existing, id: "b-3" });
    const res = await POST(req());
    expect(res!.status).toBe(200);
  });
});
