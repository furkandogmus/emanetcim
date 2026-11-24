import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Araci kodu iki tasiyicidan AYNI servise gider: web cerezden, mobil
 * `affiliateCode` alanindan. Tasiyici indirimi hesaplamaz ve atfi yazmaz;
 * yalnizca `checkoutDiscountService` sonucunu `createInitialBooking`e iletir.
 */

const m = vi.hoisted(() => ({
  claim: vi.fn(),
  preview: vi.fn(),
  create: vi.fn(),
  release: vi.fn(),
  cookie: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn().mockResolvedValue({ user: { id: "guest-1", email: null } }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));
vi.mock("@/lib/db", () => ({
  default: {
    shop: {
      findUnique: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
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
      }),
    },
  },
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/ShopScheduleService", () => ({ loadScheduleParts: vi.fn().mockResolvedValue(new Map()) }));
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
    stayDays: 2,
  }),
  checkoutLineItems: () => [],
  validateBookingStayWindow: () => true,
}));
vi.mock("@/services/CheckoutDiscountService", () => ({
  checkoutDiscountService: { claim: m.claim, preview: m.preview },
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

import { POST as intentPOST } from "@/app/api/mobile/checkout/intent/route";
import { POST as quotePOST } from "@/app/api/mobile/checkout/quote/route";
import { createBookingAction } from "@/actions/booking";

const SHOP = "11111111-1111-4111-8111-111111111111";
const body = {
  shopId: SHOP,
  checkInTime: "2030-01-01T10:00:00.000Z",
  checkOutTime: "2030-01-03T10:00:00.000Z",
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
};
const mreq = (url: string, extra: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/mobile/checkout/${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...extra }),
  });

const AFF_CLAIM = {
  totalPrice: 270,
  couponDiscountAmount: 0,
  referralDiscountAmount: 0,
  affiliateDiscountAmount: 30,
  affiliateCode: "AHMET-EV",
  affiliate: { affiliateId: "aff-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  m.claim.mockResolvedValue(AFF_CLAIM);
  m.create.mockImplementation(async (d: { checkInTime: Date; checkOutTime: Date }) => ({
    id: "b1",
    status: "APPROVED",
    qrCodeToken: "qr",
    guestEmail: null,
    checkInTime: d.checkInTime,
    checkOutTime: d.checkOutTime,
  }));
  m.cookie.mockReturnValue(undefined);
});

describe("mobil: affiliateCode", () => {
  it("kod servise gider, indirimli toplam ve atif kodu olusturmaya iletilir", async () => {
    const res = (await intentPOST(mreq("intent", { affiliateCode: "ahmet-ev", expectedTotal: 270 })))!;
    expect(res.status).toBe(200);
    expect(m.claim).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 300, affiliateCode: "ahmet-ev", guest: { userId: "guest-1" } }));
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalPrice: 270, affiliateCode: "AHMET-EV", affiliateDiscountAmount: 30 }),
    );
    expect((await res.json()).totalPrice).toBe(270);
  });

  it("gosterilen tutar eskiyse (araci durduruldu) yazmadan 409", async () => {
    m.claim.mockResolvedValue({ ...AFF_CLAIM, totalPrice: 300, affiliateDiscountAmount: 0, affiliateCode: undefined });
    const res = (await intentPOST(mreq("intent", { affiliateCode: "AHMET-EV", expectedTotal: 270 })))!;
    expect(res.status).toBe(409);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("quote: araci satiri DTO ile doner, fiyat istemcide hesaplanmaz", async () => {
    m.preview.mockResolvedValue({
      total: 270,
      discount: { kind: "affiliate", code: "AHMET-EV", amount: 30 },
      codeStatus: null,
      minPrice: null,
      affiliate: { code: "AHMET-EV", status: "applied", ratePct: 10, amount: 30 },
    });
    const res = (await quotePOST(mreq("quote", { affiliateCode: "AHMET-EV" })))!;
    const json = await res.json();
    expect(json).toMatchObject({ subtotal: 300, total: 270, affiliate: { status: "applied", amount: 30 } });
    expect(m.preview).toHaveBeenCalledWith(expect.objectContaining({ affiliateCode: "AHMET-EV" }));
  });
});

describe("web: cerez", () => {
  const input = {
    shopId: SHOP,
    bagCountS: 1,
    bagCountM: 0,
    bagCountXl: 0,
    unitPrice: 100,
    totalPrice: 1,
    checkInTime: new Date(body.checkInTime),
    checkOutTime: new Date(body.checkOutTime),
  };

  it("`bp_aff` cerezi servise gider; istemcinin toplami yok sayilir", async () => {
    m.auth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST", email: "g@example.test" } });
    m.cookie.mockImplementation((k: string) => (k === "bp_aff" ? { value: "AHMET-EV" } : undefined));
    const r = await createBookingAction(input);
    expect(r.success).toBe(true);
    expect(m.claim).toHaveBeenCalledWith(expect.objectContaining({ affiliateCode: "AHMET-EV", subtotal: 300 }));
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ totalPrice: 270, affiliateCode: "AHMET-EV" }));
  });

  it("ekran toplami sunucu toplamindan farkliysa yazmaz, kupon hakkini geri verir", async () => {
    m.auth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
    m.cookie.mockImplementation((k: string) => (k === "bp_aff" ? { value: "AHMET-EV" } : undefined));
    m.claim.mockResolvedValue({ ...AFF_CLAIM, couponId: "c1" });
    const r = await createBookingAction({ ...input, expectedTotal: 250 });
    expect(r).toEqual({ success: false, error: "Errors.priceChanged" });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.release).toHaveBeenCalledWith("c1");
  });

  it("cerez yoksa atif kodu gitmez", async () => {
    m.auth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
    m.claim.mockResolvedValue({ ...AFF_CLAIM, totalPrice: 300, affiliateDiscountAmount: 0, affiliateCode: undefined, affiliate: null });
    await createBookingAction(input);
    expect(m.claim).toHaveBeenCalledWith(expect.objectContaining({ affiliateCode: null }));
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ affiliateCode: undefined }));
  });
});

/* Kanal ve afis atfi (2026-11-25): yalniz istatistik; tasiyici dogrulanmis atfi iletir. */
describe("kanal: afis atfi", () => {
  process.env.AUTH_SECRET ??= crypto.randomUUID() + crypto.randomUUID();

  it("mobil: pencere icindeki afis atfi poster, yoksa app", async () => {
    await intentPOST(mreq("intent", { posterAttribution: { shopId: SHOP, capturedAt: new Date().toISOString() } }));
    expect(m.create).toHaveBeenLastCalledWith(expect.objectContaining({ source: "poster", sourceShopId: SHOP }));
    await intentPOST(mreq("intent", {}));
    expect(m.create).toHaveBeenLastCalledWith(expect.objectContaining({ source: "app", sourceShopId: null }));
  });

  it("mobil: suresi gecmis ya da bozuk atif yok sayilir, istek yine basarili", async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = (await intentPOST(mreq("intent", { posterAttribution: { shopId: SHOP, capturedAt: old } })))!;
    expect(res.status).toBe(200);
    expect(m.create).toHaveBeenLastCalledWith(expect.objectContaining({ source: "app" }));
    const bad = (await intentPOST(mreq("intent", { posterAttribution: "x" })))!;
    expect(bad.status).toBe(200);
  });

  it("web: imzali afis cerezi poster, elle yazilmis cerez web", async () => {
    const { signPosterAttribution } = await import("@/lib/booking-source");
    m.auth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
    const input = {
      shopId: SHOP, bagCountS: 1, bagCountM: 0, bagCountXl: 0, unitPrice: 100, totalPrice: 1,
      checkInTime: new Date(body.checkInTime), checkOutTime: new Date(body.checkOutTime),
    };
    m.cookie.mockImplementation((k: string) => (k === "bp_poster" ? { value: signPosterAttribution(SHOP) } : undefined));
    await createBookingAction(input);
    expect(m.create).toHaveBeenLastCalledWith(expect.objectContaining({ source: "poster", sourceShopId: SHOP }));
    m.cookie.mockImplementation((k: string) => (k === "bp_poster" ? { value: `${SHOP}.${Date.now()}.forged` } : undefined));
    await createBookingAction(input);
    expect(m.create).toHaveBeenLastCalledWith(expect.objectContaining({ source: "web", sourceShopId: null }));
  });
});
