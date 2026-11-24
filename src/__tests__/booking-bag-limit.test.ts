import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Valiz sayisi ust siniri (2026-11-24). Fiyat `clampBagCount` ile her boyu
 * `maxBagsPerSlot`a kirpip hesapliyordu, web action ise ham sayiyi servise
 * yaziyordu: 80 XL birakan misafir 50 XL oduyordu. Artik kirpilacak istek
 * her tasiyicida reddedilir ve servis de sinir ustunu kabul etmez.
 */

const m = vi.hoisted(() => ({
  claim: vi.fn(),
  create: vi.fn(),
  release: vi.fn(),
  auth: vi.fn(),
  shopFind: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn().mockResolvedValue({ user: { id: "guest-1", email: null } }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));
vi.mock("@/lib/db", () => ({
  default: { shop: { findUnique: m.shopFind }, booking: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/ShopScheduleService", () => ({
  loadScheduleParts: vi.fn().mockResolvedValue(new Map()),
  findClosedStayDay: vi.fn().mockResolvedValue(null),
  isClosedAtStayTimes: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/stay-days", () => ({
  snapStayToShopHours: (_s: unknown, a: Date, b: Date) => ({ checkIn: a, checkOut: b }),
}));
vi.mock("@/lib/platform-settings", async () => {
  const { DEFAULT_PRICING_RULES } = await import("@/lib/pricing-rules");
  return { getPricingRules: vi.fn().mockResolvedValue({ ...DEFAULT_PRICING_RULES, maxBagsPerSlot: 50 }) };
});
vi.mock("@/services/CheckoutDiscountService", () => ({ checkoutDiscountService: { claim: m.claim } }));
vi.mock("@/services/CouponService", () => ({ couponService: { release: m.release } }));
vi.mock("@/services/BookingService", () => ({
  bookingService: { findBookingByIdempotencyKey: vi.fn().mockResolvedValue(null), createInitialBooking: m.create },
}));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyBookingSuccess: vi.fn().mockResolvedValue(undefined),
    notifyPartnerAndAdminsForNewPaidBooking: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/services/AnalyticsService", () => ({ analyticsService: { track: vi.fn() } }));
vi.mock("@/lib/analytics-server", () => ({ resolveServerSessionId: vi.fn().mockResolvedValue("s") }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: () => "127.0.0.1" }),
  cookies: vi.fn(async () => ({ get: () => undefined, has: () => false })),
}));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn().mockResolvedValue("tr") }));

import { createBookingAction } from "@/actions/booking";
import { POST as intentPOST } from "@/app/api/mobile/checkout/intent/route";
import { bagCountsFitRules } from "@/lib/booking-server-price";

const SHOP = "11111111-1111-4111-8111-111111111111";
const checkInTime = new Date(Date.now() + 2 * 3600_000);
const checkOutTime = new Date(Date.now() + 26 * 3600_000);
const input = {
  shopId: SHOP,
  bagCountS: 0,
  bagCountM: 0,
  bagCountXl: 2,
  unitPrice: 100,
  totalPrice: 300,
  checkInTime,
  checkOutTime,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1", email: null } });
  m.shopFind.mockResolvedValue({
    id: SHOP,
    name: "Ornek Dukkan",
    isActive: true,
    isTest: false,
    isPrelaunch: false,
    pricePerDay: 100,
    open247: true,
    openingTime: null,
    closingTime: null,
    timezone: "Europe/Istanbul",
    owner: { phone: null },
  });
  m.claim.mockImplementation(async ({ subtotal }: { subtotal: number }) => ({
    totalPrice: subtotal,
    couponDiscountAmount: 0,
    referralDiscountAmount: 0,
    affiliateDiscountAmount: 0,
  }));
  m.create.mockImplementation(async (d: { checkInTime: Date; checkOutTime: Date }) => ({
    id: "b1",
    status: "APPROVED",
    qrCodeToken: "qr",
    totalPrice: 0,
    checkInTime: d.checkInTime,
    checkOutTime: d.checkOutTime,
  }));
});

describe("bagCountsFitRules", () => {
  it("yalnizca kirpilmadan gecen sayilari kabul eder", () => {
    expect(bagCountsFitRules({ bagCountS: 50, bagCountM: 0, bagCountXl: 0 }, 50)).toBe(true);
    expect(bagCountsFitRules({ bagCountS: 0, bagCountM: 0, bagCountXl: 80 }, 50)).toBe(false);
    expect(bagCountsFitRules({ bagCountS: -1, bagCountM: 0, bagCountXl: 1 }, 50)).toBe(false);
    expect(bagCountsFitRules({ bagCountS: 1.5, bagCountM: 0, bagCountXl: 0 }, 50)).toBe(false);
  });
});

describe("web createBookingAction", () => {
  it("sinir ustu valiz reddedilir; kupon alinmaz, rezervasyon yazilmaz", async () => {
    const res = await createBookingAction({ ...input, bagCountXl: 80 });
    expect(res).toEqual({ success: false, error: "Errors.invalidData" });
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("sifir valiz kupon hakki almadan reddedilir (maxUses tukenmez)", async () => {
    const res = await createBookingAction({ ...input, bagCountXl: 0, couponCode: "YAZ10" });
    expect(res).toEqual({ success: false, error: "Errors.invalidData" });
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("kupon alindiktan sonraki erken donus hakki geri verir", async () => {
    m.claim.mockResolvedValueOnce({
      totalPrice: 1,
      couponId: "c1",
      couponDiscountAmount: 0,
      referralDiscountAmount: 0,
      affiliateDiscountAmount: 0,
    });
    const res = await createBookingAction({ ...input, couponCode: "YAZ10", expectedTotal: 999 });
    expect(res).toEqual({ success: false, error: "Errors.priceChanged" });
    expect(m.release).toHaveBeenCalledWith("c1");
  });

  it("servise fiyatlanan sayilar gider", async () => {
    const res = await createBookingAction(input);
    expect(res).toMatchObject({ success: true });
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({ bagCountS: 0, bagCountM: 0, bagCountXl: 2 }),
    );
  });
});

describe("mobil checkout/intent", () => {
  function post(body: Record<string, unknown>) {
    return intentPOST(
      new NextRequest("http://localhost/api/mobile/checkout/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP,
          checkInTime: checkInTime.toISOString(),
          checkOutTime: checkOutTime.toISOString(),
          bagCountS: 0,
          bagCountM: 0,
          bagCountXl: 2,
          ...body,
        }),
      }),
    );
  }

  it("platform siniri zod tavanindan dusukse sinir ustu 400 alir", async () => {
    const { getPricingRules } = await import("@/lib/platform-settings");
    const { DEFAULT_PRICING_RULES } = await import("@/lib/pricing-rules");
    vi.mocked(getPricingRules).mockResolvedValueOnce({ ...DEFAULT_PRICING_RULES, maxBagsPerSlot: 5 });
    const res = (await post({ bagCountXl: 8 }))!;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_data");
    expect(m.create).not.toHaveBeenCalled();
  });
});

describe("servis kapisi: createInitialBooking", () => {
  it("her tasiyici icin sinir ustu INVALID_INPUT", async () => {
    const { createInitialBooking } =
      await vi.importActual<typeof import("@/services/booking/create")>("@/services/booking/create");
    await expect(
      createInitialBooking({ ...input, guestId: "u1", bagCountXl: 51 } as never),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    // Shop sorgusu sinirdan SONRA: reddedilen istek veritabanina gitmez.
    expect(m.shopFind).not.toHaveBeenCalled();
  });
});
