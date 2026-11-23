import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Yeni rezervasyon yalnizca hesapla (2026-11-23, "web'te hesapsiz rezervasyonu
 * kapat"). Oturumsuz istek kupon/kapasite/slot isine girmeden `login_required`
 * alir; kapi hem web action'inda hem serviste. Eski hesapsiz kayitlarin yonetimi
 * `guest-checkout-email.test.ts` ve `guest-booking-link.test.ts`te.
 */

const m = vi.hoisted(() => ({
  claim: vi.fn(),
  create: vi.fn(),
  release: vi.fn(),
  cookie: vi.fn(),
  auth: vi.fn(),
  shopFind: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn().mockResolvedValue({ user: { id: "guest-1", email: null } }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));
vi.mock("@/lib/db", () => ({ default: { shop: { findUnique: m.shopFind } } }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/ShopScheduleService", () => ({ loadScheduleParts: vi.fn().mockResolvedValue(new Map()) }));
vi.mock("@/lib/stay-days", () => ({
  snapStayToShopHours: (_s: unknown, a: Date, b: Date) => ({ checkIn: a, checkOut: b }),
}));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/booking-server-price", () => ({
  computeAuthoritativeCheckoutTotals: () => ({
    subtotalBeforeCoupon: 300,
    unitPrice: 100,
    insuranceFee: 0,
    bagCountS: 1,
    bagCountM: 0,
    bagCountXl: 0,
    stayDays: 2,
  }),
  checkoutLineItems: () => [],
  validateBookingStayWindow: () => true,
}));
vi.mock("@/services/CheckoutDiscountService", () => ({
  checkoutDiscountService: { claim: m.claim },
}));
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
  cookies: vi.fn(async () => ({ get: m.cookie, has: (k: string) => !!m.cookie(k) })),
}));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn().mockResolvedValue("tr") }));

import { createBookingAction } from "@/actions/booking";
import { POST as intentPOST } from "@/app/api/mobile/checkout/intent/route";
import { POST as legacyCheckoutPOST } from "@/app/api/checkout/route";
import { BookingLoginRequiredError } from "@/services/booking/errors";

const SHOP = "11111111-1111-4111-8111-111111111111";
const input = {
  shopId: SHOP,
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  unitPrice: 100,
  totalPrice: 300,
  checkInTime: new Date("2030-01-01T10:00:00.000Z"),
  checkOutTime: new Date("2030-01-03T10:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
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
  m.claim.mockResolvedValue({
    totalPrice: 300,
    couponDiscountAmount: 0,
    referralDiscountAmount: 0,
    affiliateDiscountAmount: 0,
    affiliate: null,
  });
  m.create.mockImplementation(async (d: { checkOutTime: Date }) => ({
    id: "b1",
    status: "APPROVED",
    qrCodeToken: "qr",
    guestEmail: null,
    checkOutTime: d.checkOutTime,
  }));
  m.cookie.mockReturnValue(undefined);
});

describe("web createBookingAction: oturum kapisi", () => {
  it("oturumsuz istek login_required alir; dukkan, kupon ve olusturma HIC calismaz", async () => {
    m.auth.mockResolvedValue(null);
    const res = await createBookingAction({ ...input, couponCode: "YAZ10" });
    expect(res).toEqual({ success: false, error: "Errors.loginRequired", code: "login_required" });
    expect(m.shopFind).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("eski istemcinin gonderdigi misafir e-postasi oturumun yerine gecmez", async () => {
    m.auth.mockResolvedValue(null);
    const res = await createBookingAction({ ...input, guestEmail: "ada@example.com" } as never);
    expect(res).toMatchObject({ success: false, code: "login_required" });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("oturumlu misafirde akis degismedi: hesapla yaratilir, misafir iletisim alani yazilmaz", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1", email: "ada@example.com" } });
    const res = await createBookingAction(input);
    expect(res).toMatchObject({ success: true, bookingId: "b1" });
    const arg = m.create.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.guestId).toBe("u1");
    expect(arg).not.toHaveProperty("guestEmail");
    expect(arg).not.toHaveProperty("guestPhone");
    expect(m.claim).toHaveBeenCalledWith(expect.objectContaining({ guest: { userId: "u1" } }));
  });

  it("girisle donen misafirde araci cerezi ve kupon hala uygulanir", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1", email: "ada@example.com" } });
    m.cookie.mockImplementation((k: string) => (k === "bp_aff" ? { value: "AHMET-EV" } : undefined));
    await createBookingAction({ ...input, couponCode: "YAZ10" });
    expect(m.claim).toHaveBeenCalledWith(
      expect.objectContaining({ affiliateCode: "AHMET-EV", couponCode: "YAZ10" }),
    );
  });

  it("servis LOGIN_REQUIRED firlatirsa kupon hakki geri verilir, ayni anahtar ve kod doner", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1", email: null } });
    m.claim.mockResolvedValue({
      totalPrice: 270,
      couponId: "c1",
      couponDiscountAmount: 30,
      referralDiscountAmount: 0,
      affiliateDiscountAmount: 0,
      affiliate: null,
    });
    m.create.mockRejectedValue(new BookingLoginRequiredError());
    const res = await createBookingAction(input);
    expect(res).toEqual({ success: false, error: "Errors.loginRequired", code: "login_required" });
    expect(m.release).toHaveBeenCalledWith("c1");
  });
});

describe("servis kapisi: createInitialBooking", () => {
  it("guestId bos ya da yoksa LOGIN_REQUIRED, veritabanina gidilmeden", async () => {
    const { createInitialBooking } =
      await vi.importActual<typeof import("@/services/booking/create")>("@/services/booking/create");
    for (const guestId of [undefined, null, "", "  "]) {
      await expect(
        createInitialBooking({ ...input, guestId, guestEmail: "ada@example.com" } as never),
      ).rejects.toMatchObject({ code: "LOGIN_REQUIRED" });
    }
    expect(m.shopFind).not.toHaveBeenCalled();
  });
});

describe("diger olusturma yollari", () => {
  it("mobil uc servisin LOGIN_REQUIRED kodunu 401 login_required'a cevirir", async () => {
    m.create.mockRejectedValue(new BookingLoginRequiredError());
    const res = (await intentPOST(
      new NextRequest("http://localhost/api/mobile/checkout/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP,
          checkInTime: "2030-01-01T10:00:00.000Z",
          checkOutTime: "2030-01-03T10:00:00.000Z",
          bagCountS: 1,
          bagCountM: 0,
          bagCountXl: 0,
        }),
      }),
    ))!;
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("login_required");
  });

  it("eski /api/checkout ucu kapali kalir (410), rezervasyon yaratmaz", async () => {
    const res = await legacyCheckoutPOST();
    expect(res.status).toBe(410);
    expect(m.create).not.toHaveBeenCalled();
  });
});
