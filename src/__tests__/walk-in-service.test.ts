import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Kapidan gelen misafir servisi ve mobil ucu: yetki matrisi (`operate`), hiz siniri,
 * muhur devri, bildirim. Yetki kapisi GERCEK (`shop-access.ts`), veritabani sahte.
 */
const h = vi.hoisted(() => ({
  prisma: {
    shop: { findUnique: vi.fn() },
    shopMember: { findUnique: vi.fn() },
    booking: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
  claimOnce: vi.fn(),
  rateLimit: vi.fn(),
  rules: { maxBagsPerSlot: 50, insuranceFeeTry: 0, defaultPricePerDay: 250, bagMultipliers: { S: 1, M: 1, XL: 1 }, requireSealsOnCheckIn: false },
  create: vi.fn(),
  checkIn: vi.fn(),
  notify: vi.fn(),
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: h.prisma }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: h.rateLimit, claimOnce: h.claimOnce }));
vi.mock("@/lib/platform-settings", async () => {
  const { DEFAULT_PRICING_RULES } = await import("@/lib/pricing-rules");
  return { getPricingRules: vi.fn(async () => ({ ...DEFAULT_PRICING_RULES, ...h.rules })) };
});
vi.mock("@/services/booking/create", () => ({ createWalkInBooking: h.create }));
vi.mock("@/services/BookingService", () => ({ bookingService: { checkIn: h.checkIn } }));
vi.mock("@/services/NotificationService", () => ({ notificationService: { notifyWalkInBookingCreated: h.notify } }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: h.requireMobileUser,
}));

import {
  walkInBookingService,
  WALK_IN_EMAIL_LIMIT,
  WALK_IN_OPERATOR_LIMIT,
  WALK_IN_SHOP_LIMIT,
} from "@/services/WalkInBookingService";
import { BookingCapacityExceededError, BookingShopClosedError } from "@/services/booking/errors";
import { POST } from "@/app/api/mobile/partner/walk-in/route";

process.env.AUTH_SECRET ??= crypto.randomUUID() + crypto.randomUUID();

const SHOP_ID = "0b7e3c1a-2f4d-4c8e-9a1b-3d5e7f9a1b2c";
const OWNER = { id: "owner-1", role: "PARTNER" as const };
const STAFF = { id: "staff-1", role: "GUEST" as const };
const OTHER_STAFF = { id: "staff-2", role: "GUEST" as const };
const GUEST = { id: "guest-1", role: "GUEST" as const };
const ADMIN = { id: "admin-1", role: "ADMIN" as const };

function input(over: Record<string, unknown> = {}) {
  return {
    shopId: SHOP_ID,
    guestName: "Ada Misafir",
    bagCount: 2,
    pickupAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    termsConfirmed: true,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rules.requireSealsOnCheckIn = false;
  h.rateLimit.mockResolvedValue(true);
  h.claimOnce.mockResolvedValue(true);
  h.prisma.booking.findFirst.mockResolvedValue(null);
  h.prisma.shop.findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) =>
    select.isActive
      ? { id: SHOP_ID, isActive: true, isPrelaunch: false, pricePerDay: 250 }
      : { id: SHOP_ID, ownerId: OWNER.id },
  );
  // Yalniz staff-1 bu dukkanin personeli; staff-2 baska dukkanin.
  h.prisma.shopMember.findUnique.mockImplementation(async ({ where }: { where: { shopId_userId: { userId: string } } }) =>
    where.shopId_userId.userId === STAFF.id ? { id: "m1" } : null,
  );
  h.create.mockImplementation(async (data: { checkInTime: Date; checkOutTime: Date }) => ({
    id: "b0b0b0b0-1111-2222-3333-444455556666",
    qrCodeToken: "qr-token",
    checkInTime: data.checkInTime,
    checkOutTime: data.checkOutTime,
  }));
  h.checkIn.mockResolvedValue({ ok: true });
  h.notify.mockResolvedValue(undefined);
});

describe("yetki matrisi (operate)", () => {
  it.each([
    ["sahip", OWNER, true],
    ["personel", STAFF, true],
    ["yonetici", ADMIN, true],
    ["baska dukkanin personeli", OTHER_STAFF, false],
    ["misafir", GUEST, false],
  ])("%s", async (_label, actor, allowed) => {
    const r = await walkInBookingService.create(actor, input());
    expect(r.ok).toBe(allowed);
    if (!allowed) {
      expect(r).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(h.create).not.toHaveBeenCalled();
      // Yetkisiz istek hiz sayacini tuketmez.
      expect(h.rateLimit).not.toHaveBeenCalled();
    }
  });

  it("operatorun iliskisi olaya yazilir; misafir verisi olaya yazilmaz", async () => {
    await walkInBookingService.create(STAFF, input({ guestEmail: "misafir@example.com" }));
    const walkIn = h.create.mock.calls[0][1];
    expect(walkIn.operator).toEqual({ id: STAFF.id, role: "GUEST" });
    expect(walkIn.eventMetadata).toMatchObject({
      channel: "walk_in",
      operatorRelation: "staff",
      contact: { email: true, phone: false },
      consent: { confirmedByOperator: true, terms: "1", privacy: "1" },
    });
    expect(JSON.stringify(walkIn.eventMetadata)).not.toContain("misafir@example.com");
  });
});

describe("dogrulama ve sinirlar", () => {
  it("sartlar onaylanmadan acilmaz", async () => {
    expect(await walkInBookingService.create(OWNER, input({ termsConfirmed: false }))).toEqual({
      ok: false,
      code: "TERMS_REQUIRED",
    });
  });

  it("gecersiz e-posta / kisa ad reddedilir", async () => {
    expect((await walkInBookingService.create(OWNER, input({ guestEmail: "x@" }))).ok).toBe(false);
    expect((await walkInBookingService.create(OWNER, input({ guestName: "A" }))).ok).toBe(false);
  });

  it("operator ve dukkan basina hiz siniri", async () => {
    h.rateLimit.mockResolvedValueOnce(false);
    expect(await walkInBookingService.create(STAFF, input())).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(h.rateLimit).toHaveBeenCalledWith(`walkin_op:${STAFF.id}`, WALK_IN_OPERATOR_LIMIT.max, WALK_IN_OPERATOR_LIMIT.windowMs);

    h.rateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await walkInBookingService.create(STAFF, input())).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(h.rateLimit).toHaveBeenCalledWith(`walkin_shop:${SHOP_ID}`, WALK_IN_SHOP_LIMIT.max, WALK_IN_SHOP_LIMIT.windowMs);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("platform siniri ustu valiz reddedilir", async () => {
    h.rules.maxBagsPerSlot = 3;
    expect(await walkInBookingService.create(OWNER, input({ bagCount: 4 }))).toEqual({ ok: false, code: "TOO_MANY_BAGS" });
    h.rules.maxBagsPerSlot = 50;
  });

  it("pasif ya da talep testi dukkani", async () => {
    h.prisma.shop.findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) =>
      select.isActive ? { id: SHOP_ID, isActive: false, isPrelaunch: false, pricePerDay: 250 } : { id: SHOP_ID, ownerId: OWNER.id },
    );
    expect(await walkInBookingService.create(OWNER, input())).toEqual({ ok: false, code: "SHOP_NOT_OPERATING" });
  });

  it("kapasite ve saat redleri kodla doner", async () => {
    h.create.mockRejectedValueOnce(new BookingCapacityExceededError("dolu"));
    expect(await walkInBookingService.create(OWNER, input())).toEqual({ ok: false, code: "CAPACITY_EXCEEDED" });
    h.create.mockRejectedValueOnce(new BookingShopClosedError());
    expect(await walkInBookingService.create(OWNER, input())).toEqual({ ok: false, code: "SHOP_CLOSED_ON_DATE" });
  });

  it("fiyat sunucuda, indirimsiz: valiz x gun x dukkan fiyati", async () => {
    await walkInBookingService.create(OWNER, input({ bagCount: 3 }));
    expect(h.create.mock.calls[0][0]).toMatchObject({ totalPrice: 750, bagCountM: 3, bagCountS: 0, bagCountXl: 0 });
  });
});

describe("teslim alma ve bildirim", () => {
  it("muhur kapaliyken hemen teslim alinir", async () => {
    const r = await walkInBookingService.create(STAFF, input());
    expect(h.checkIn).toHaveBeenCalledWith(expect.any(String), undefined, { id: STAFF.id, role: "GUEST", impersonatedBy: null });
    expect(r).toMatchObject({ ok: true, checkedIn: true, needsCheckIn: false, emailQueued: false });
  });

  it("muhur zorunluysa teslim normal check-in ekranina devredilir", async () => {
    h.rules.requireSealsOnCheckIn = true;
    const r = await walkInBookingService.create(OWNER, input());
    expect(h.checkIn).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, checkedIn: false, needsCheckIn: true });
  });

  it("check-in reddedilirse rezervasyon kalir, kod doner", async () => {
    h.checkIn.mockResolvedValue({ ok: false, code: "SHOP_CLOSED" });
    const r = await walkInBookingService.create(OWNER, input());
    expect(r).toMatchObject({ ok: true, needsCheckIn: true, checkInErrorCode: "SHOP_CLOSED" });
  });

  it("e-posta verildiyse onay yonetim bagiyla gider", async () => {
    const r = await walkInBookingService.create(OWNER, input({ guestEmail: "Misafir@Example.com" }), { locale: "en" });
    expect(r).toMatchObject({ ok: true, emailQueued: true });
    // Onceki testin atesle-unut gonderimi gec dusebilir; bu cagri dile gore aranir.
    await vi.waitFor(() =>
      expect(h.notify).toHaveBeenCalledWith({
        email: "misafir@example.com",
        bookingId: expect.any(String),
        totalPrice: 500,
        locale: "en",
        manageUrl: expect.stringMatching(/\/en\/bookings\/manage\//),
      }),
    );
    expect(h.create.mock.calls[0][1].guestEmail).toBe("misafir@example.com");
  });

  it("ayni adrese gunluk e-posta siniri: rezervasyon acilir, e-posta atlanir", async () => {
    h.rateLimit.mockImplementation(async (k: string) => !k.startsWith("walkin_email:"));
    const r = await walkInBookingService.create(OWNER, input({ guestEmail: "spam@example.com" }));
    expect(r).toMatchObject({ ok: true, emailQueued: false, qrCodeToken: "qr-token" });
    expect(h.create).toHaveBeenCalled();
    expect(h.rateLimit).toHaveBeenCalledWith("walkin_email:spam@example.com", WALK_IN_EMAIL_LIMIT.max, WALK_IN_EMAIL_LIMIT.windowMs);
  });

  it("iletisimsiz misafir: e-posta yok, kod ve QR doner", async () => {
    const r = await walkInBookingService.create(OWNER, input());
    expect(h.notify).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, qrCodeToken: "qr-token", shortCode: "B0B0B0B0" });
  });
});

describe("mobil uc", () => {
  const req = (body: unknown) =>
    new NextRequest("https://bagajpark.com/api/mobile/partner/walk-in", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("personel 201 alir", async () => {
    h.requireMobileUser.mockResolvedValue({ user: STAFF });
    const res = (await POST(req(input())))!;
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ checkedIn: true, shortCode: "B0B0B0B0" });
  });

  it("baska dukkanin personeli dukkani 404 gorur", async () => {
    h.requireMobileUser.mockResolvedValue({ user: OTHER_STAFF });
    const res = (await POST(req(input())))!;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "shop_not_found" });
  });

  it("hiz siniri 429", async () => {
    h.requireMobileUser.mockResolvedValue({ user: OWNER });
    h.rateLimit.mockResolvedValue(false);
    expect((await POST(req(input())))!.status).toBe(429);
  });
});

describe("tekrar (idempotency)", () => {
  const KEY = "form-0123456789";

  it("ayni anahtar kayitli rezervasyonu doner, ikinci kez yazmaz ve sinir tuketmez", async () => {
    h.prisma.booking.findFirst.mockResolvedValue({
      id: "b0b0b0b0-1111-2222-3333-444455556666",
      status: "CHECKED_IN",
      qrCodeToken: "qr-token",
      totalPrice: 500,
      checkInTime: new Date(),
      checkOutTime: new Date(Date.now() + 3600_000),
    });
    const r = await walkInBookingService.create(STAFF, input({ idempotencyKey: KEY }));
    expect(r).toMatchObject({ ok: true, checkedIn: true, needsCheckIn: false, emailQueued: false });
    expect(h.create).not.toHaveBeenCalled();
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.prisma.booking.findFirst.mock.calls[0][0].where).toEqual({ shopId: SHOP_ID, source: "walk_in", idempotencyKey: KEY });
  });

  it("esanli ikinci istek: kilit alinamaz, kayit yoksa IN_PROGRESS (409)", async () => {
    h.claimOnce.mockResolvedValue(false);
    expect(await walkInBookingService.create(STAFF, input({ idempotencyKey: KEY }))).toEqual({ ok: false, code: "IN_PROGRESS" });
    h.requireMobileUser.mockResolvedValue({ user: STAFF });
    const res = (await POST(
      new NextRequest("https://bagajpark.com/api/mobile/partner/walk-in", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json", "idempotency-key": KEY },
        body: JSON.stringify(input()),
      }),
    ))!;
    expect(res.status).toBe(409);
    expect(h.claimOnce).toHaveBeenLastCalledWith(`walkin_idem:${SHOP_ID}:${KEY}`, expect.any(Number));
  });

  it("ilk istek anahtari rezervasyona yazar", async () => {
    await walkInBookingService.create(STAFF, input({ idempotencyKey: KEY }));
    expect(h.create.mock.calls[0][0].idempotencyKey).toBe(KEY);
  });

  it("bozuk anahtar reddedilir", async () => {
    expect(await walkInBookingService.create(STAFF, input({ idempotencyKey: "x" }))).toEqual({ ok: false, code: "INVALID_INPUT" });
  });
});

describe("saklama (KVKK)", () => {
  it("baglanmamis walk-in satirinda iletisim 180 gun sonra bosaltilir", async () => {
    h.prisma.booking.updateMany.mockResolvedValue({ count: 2 });
    const now = new Date("2026-11-25T00:00:00Z");
    expect(await walkInBookingService.purgeExpiredGuestContact(now)).toBe(2);
    const arg = h.prisma.booking.updateMany.mock.calls[0][0];
    expect(arg.data).toEqual({ guestName: null, guestEmail: null, guestPhone: null });
    expect(arg.where).toMatchObject({ source: "walk_in", guestId: null });
    const cutoff = arg.where.AND[0].OR[0].checkedOutAt.lt as Date;
    expect(cutoff.toISOString()).toBe("2026-05-29T00:00:00.000Z");
  });
});
