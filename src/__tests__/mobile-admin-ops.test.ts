import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil yonetim araclari: uyusmazlik, kupon, odeme defteri, platform ayari, bayrak.
 * Her kural iki taraftan olculur: mobil uc ve web action AYNI servis govdesinden
 * ayni sonucu almali; yonetici olmayan ve goruntuleme oturumu yazamaz; riskli
 * ayar yazarak onaysiz gecmez; her yazma denetim kaydi birakir.
 */
const { mockPrisma, mockRequireMobileUser, mockAudit, mockAuth, mockInvalidatePricing, mockInvalidateAppVersion, mockRevalidate } = vi.hoisted(() => ({
  mockPrisma: {
    dispute: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    coupon: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    paymentLog: { findMany: vi.fn(), aggregate: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
    paymentSplit: { aggregate: vi.fn(), update: vi.fn() },
    merchantPaymentAccount: { findMany: vi.fn() },
    platformSettings: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    featureFlag: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  },
  mockRequireMobileUser: vi.fn(),
  mockAudit: vi.fn(),
  mockAuth: vi.fn(),
  mockInvalidatePricing: vi.fn(),
  mockInvalidateAppVersion: vi.fn(),
  mockRevalidate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAudit }));
// Muhur fotografi ozel: yonetici yolu imzali adres doner (`private-read.test.ts`).
vi.mock("@/lib/storage/private-read", () => ({
  presignStoredImage: async (v: string | null) => (v ? `${v}?signed` : null),
}));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/client-ip", async (orig) => ({
  ...(await orig<typeof import("@/lib/client-ip")>()),
  getClientIpOrNull: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: mockRevalidate }));
vi.mock("@/lib/platform-settings", async (orig) => ({
  ...(await orig<typeof import("@/lib/platform-settings")>()),
  invalidatePricingRulesCache: mockInvalidatePricing,
}));
vi.mock("@/lib/app-version", async (orig) => ({
  ...(await orig<typeof import("@/lib/app-version")>()),
  invalidateAppVersionGateCache: mockInvalidateAppVersion,
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));

import { Prisma } from "@prisma/client";
import * as disputesList from "@/app/api/mobile/admin/disputes/route";
import * as disputeOne from "@/app/api/mobile/admin/disputes/[id]/route";
import * as couponsRoot from "@/app/api/mobile/admin/coupons/route";
import * as couponOne from "@/app/api/mobile/admin/coupons/[id]/route";
import * as paymentsRoute from "@/app/api/mobile/admin/payments/route";
import * as settingsRoute from "@/app/api/mobile/admin/platform-settings/route";
import * as flagsList from "@/app/api/mobile/admin/feature-flags/route";
import * as flagOne from "@/app/api/mobile/admin/feature-flags/[id]/route";
import { updateDisputeStatusAction } from "@/actions/dispute";
import { createCouponAction, setCouponActiveAction } from "@/actions/coupon";
import { updatePlatformSettingsAction } from "@/actions/admin";
import { updateFeatureFlagAction } from "@/actions/feature-flags";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";
import { RISKY_PLATFORM_SETTING_FIELDS } from "@/lib/admin-risky-settings";
import { featureFlagService } from "@/services/FeatureFlagService";

const ADMIN = { id: "a1", role: "ADMIN" as const, email: "a@x.com" };

function req(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`https://bagajpark.com/api/mobile/admin${path}`, {
    method,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (r: Response | undefined) => ({ status: r!.status, body: await r!.json() });

const DISPUTE_ROW = {
  id: "d1",
  bookingId: "b1",
  reason: "DAMAGE",
  description: "Valizin tekerlegi kirik",
  status: "OPEN",
  adminNote: null,
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-01T10:00:00Z"),
  booking: {
    id: "b1",
    totalPrice: new Prisma.Decimal("150.50"),
    checkInTime: new Date("2026-10-31T09:00:00Z"),
    checkOutTime: new Date("2026-10-31T18:00:00Z"),
    status: "CHECKED_OUT",
    guest: { name: "Ada", email: "ada@x.com" },
    shop: { name: "Kadikoy Bufe" },
    seals: [{ id: "s1", sealNumber: 1001, bagIndex: 0, bagSize: "M", photoUrl: "https://x/p.jpg" }],
  },
};

const SETTINGS = {
  maxStayDays: DEFAULT_PRICING_RULES.maxStayDays,
  maxBagsPerSlot: DEFAULT_PRICING_RULES.maxBagsPerSlot,
  insuranceFeeTry: DEFAULT_PRICING_RULES.insuranceFeeTry,
  earlyRefundRatio: DEFAULT_PRICING_RULES.earlyRefundRatio,
  cancelFixedFeeTry: DEFAULT_PRICING_RULES.cancelFixedFeeTry,
  latePickupFeeTry: DEFAULT_PRICING_RULES.latePickupFeeTry,
  latePickupGraceMin: DEFAULT_PRICING_RULES.latePickupGraceMin,
  checkInGraceMin: DEFAULT_PRICING_RULES.checkInGraceMin,
  requireSealsOnCheckIn: DEFAULT_PRICING_RULES.requireSealsOnCheckIn,
  defaultShopCapacity: DEFAULT_PRICING_RULES.defaultShopCapacity,
  defaultPricePerDay: DEFAULT_PRICING_RULES.defaultPricePerDay,
  bagMultiplierS: DEFAULT_PRICING_RULES.bagMultipliers.S,
  bagMultiplierM: DEFAULT_PRICING_RULES.bagMultipliers.M,
  bagMultiplierXl: DEFAULT_PRICING_RULES.bagMultipliers.XL,
  platformHolidayDates: [] as string[],
  minAppVersion: "",
  latestAppVersion: "",
};

const revalidatedPaths = () => mockRevalidate.mock.calls.map((c) => c[0] as string);
const auditActions = () => mockAudit.mock.calls.map((c) => (c[0] as { action: string }).action);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: ADMIN });
  mockAuth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
  mockPrisma.dispute.findMany.mockResolvedValue([DISPUTE_ROW]);
  mockPrisma.dispute.findUnique.mockResolvedValue(DISPUTE_ROW);
  mockPrisma.dispute.update.mockResolvedValue({});
  mockPrisma.coupon.findMany.mockResolvedValue([]);
  mockPrisma.coupon.findUnique.mockResolvedValue({ id: "c1" });
  mockPrisma.coupon.create.mockResolvedValue({ id: "c1", code: "YAZ25" });
  mockPrisma.coupon.update.mockResolvedValue({});
  mockPrisma.paymentLog.findMany.mockResolvedValue([]);
  mockPrisma.paymentLog.aggregate.mockResolvedValue({ _sum: { amount: null, refundedAmount: null }, _count: 0 });
  mockPrisma.paymentLog.count.mockResolvedValue(0);
  mockPrisma.paymentSplit.aggregate.mockResolvedValue({ _sum: { merchantAmount: null }, _count: 0 });
  mockPrisma.merchantPaymentAccount.findMany.mockResolvedValue([]);
  mockPrisma.platformSettings.findUnique.mockResolvedValue(null);
  mockPrisma.platformSettings.upsert.mockResolvedValue({});
  mockPrisma.platformSettings.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.platformSettings.create.mockResolvedValue({});
  mockPrisma.featureFlag.findMany.mockResolvedValue([]);
  mockPrisma.featureFlag.findUnique.mockResolvedValue({ id: "f1" });
  mockPrisma.featureFlag.upsert.mockResolvedValue({});
});

/* Her uc: [ad, cagri]. Yetki ve goruntuleme kurali hepsinde ayni olculur. */
const ROUTES: [string, () => Promise<Response | undefined>][] = [
  ["GET disputes", () => disputesList.GET(req("/disputes"))],
  ["GET disputes/:id", () => disputeOne.GET(req("/disputes/d1"), p("d1"))],
  ["PATCH disputes/:id", () => disputeOne.PATCH(req("/disputes/d1", "PATCH", { status: "RESOLVED" }), p("d1"))],
  ["GET coupons", () => couponsRoot.GET(req("/coupons"))],
  ["POST coupons", () => couponsRoot.POST(req("/coupons", "POST", {}))],
  ["PATCH coupons/:id", () => couponOne.PATCH(req("/coupons/c1", "PATCH", { isActive: false }), p("c1"))],
  ["GET payments", () => paymentsRoute.GET(req("/payments"))],
  ["GET platform-settings", () => settingsRoute.GET(req("/platform-settings"))],
  ["PUT platform-settings", () => settingsRoute.PUT(req("/platform-settings", "PUT", { values: SETTINGS, expectedUpdatedAt: null }))],
  ["GET feature-flags", () => flagsList.GET(req("/feature-flags"))],
  ["PATCH feature-flags/:key", () => flagOne.PATCH(req("/feature-flags/x", "PATCH", {}), p("x"))],
];

const NO_WRITES = () => {
  expect(mockPrisma.dispute.update).not.toHaveBeenCalled();
  expect(mockPrisma.coupon.create).not.toHaveBeenCalled();
  expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
  expect(mockPrisma.platformSettings.upsert).not.toHaveBeenCalled();
  expect(mockPrisma.platformSettings.updateMany).not.toHaveBeenCalled();
  expect(mockPrisma.platformSettings.create).not.toHaveBeenCalled();
  expect(mockPrisma.featureFlag.upsert).not.toHaveBeenCalled();
  expect(mockAudit).not.toHaveBeenCalled();
};

describe("yetki kapisi", () => {
  it.each(ROUTES)("%s: yonetici olmayan 403 forbidden, yazma yok", async (_n, call) => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, role: "PARTNER" } });
    const r = await json(await call());
    expect(r).toEqual({ status: 403, body: { error: "forbidden" } });
    NO_WRITES();
  });

  /*
    Gercek durum: `requireMobileUser` ADMIN hedefli goruntulemeyi zaten reddeder, yani
    goruntuleme aktorunun rolu hep PARTNER/GUEST. Kapi `requireRole`dan ONCE olmali,
    yoksa istemci `forbidden` alir ve "goruntuleme" metnini hic gostermez.
  */
  it.each(ROUTES.flatMap(([n, c]) => (["PARTNER", "GUEST"] as const).map((role) => [`${n} (${role})`, c, role] as const)))(
    "%s: goruntuleme oturumunda 403 not_allowed_while_impersonating",
    async (_n, call, role) => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, role, impersonatedBy: "a0" } });
    const r = await json(await call());
    expect(r).toEqual({ status: 403, body: { error: "not_allowed_while_impersonating" } });
    NO_WRITES();
    },
  );
});

describe("uyusmazlik", () => {
  it("liste durum suzgecini servise verir; taninmayan durum filtresiz", async () => {
    await disputesList.GET(req("/disputes?status=OPEN"));
    expect(mockPrisma.dispute.findMany.mock.calls[0][0].where).toEqual({ status: "OPEN" });
    await disputesList.GET(req("/disputes?status=BOGUS"));
    expect(mockPrisma.dispute.findMany.mock.calls[1][0].where).toEqual({});
  });

  it("detay misafir raporunu, rezervasyon baglamini ve muhur kanitini tasir", async () => {
    const r = await json(await disputeOne.GET(req("/disputes/d1"), p("d1")));
    expect(r.status).toBe(200);
    expect(r.body.description).toBe("Valizin tekerlegi kirik");
    expect(r.body.booking).toMatchObject({ totalPrice: 150.5, guestName: "Ada", shopName: "Kadikoy Bufe" });
    expect(r.body.booking.seals[0]).toMatchObject({ sealNumber: 1001, photoUrl: "https://x/p.jpg?signed" });
  });

  it("olmayan uyusmazlik 404", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValue(null);
    expect((await json(await disputeOne.GET(req("/disputes/zz"), p("zz")))).status).toBe(404);
    const r = await json(await disputeOne.PATCH(req("/disputes/zz", "PATCH", { status: "RESOLVED" }), p("zz")));
    expect(r).toEqual({ status: 404, body: { error: "not_found" } });
    expect(mockPrisma.dispute.update).not.toHaveBeenCalled();
  });

  it.each(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"])("%s durumuna gecis yazilir ve denetlenir", async (status) => {
    const r = await disputeOne.PATCH(req("/disputes/d1", "PATCH", { status, adminNote: "  hasar onaylandi " }), p("d1"));
    expect(r!.status).toBe(200);
    expect(mockPrisma.dispute.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { status, adminNote: "hasar onaylandi" },
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dispute.update_status",
        actorUserId: "a1",
        entityId: "d1",
        metadata: { from: "OPEN", to: status, hasNote: true },
      }),
    );
  });

  it("bos not null olarak yazilir (web ile ayni)", async () => {
    await disputeOne.PATCH(req("/disputes/d1", "PATCH", { status: "CLOSED", adminNote: "   " }), p("d1"));
    expect(mockPrisma.dispute.update.mock.calls[0][0].data.adminNote).toBeNull();
  });

  it("gecersiz durum: mobil 400 invalid_status, web invalidData; ikisi de yazmaz", async () => {
    const r = await json(await disputeOne.PATCH(req("/disputes/d1", "PATCH", { status: "REFUNDED" }), p("d1")));
    expect(r).toEqual({ status: 400, body: { error: "invalid_status" } });
    const w = await updateDisputeStatusAction("d1", "REFUNDED");
    expect(w).toEqual({ success: false, error: "Errors.invalidData" });
    NO_WRITES();
  });

  it("web action da ayni govdeyi kullanir: denetim kaydi ve revalidate", async () => {
    await updateDisputeStatusAction("d1", "IN_REVIEW", "bakiliyor");
    expect(auditActions()).toEqual(["dispute.update_status"]);
    expect(revalidatedPaths()).toEqual(expect.arrayContaining(["/admin/disputes", "/bookings"]));
  });

  it("not 2000 karakter: kabul; 2001: mobil 400 note_too_long, web invalidData", async () => {
    const ok = await disputeOne.PATCH(req("/disputes/d1", "PATCH", { status: "OPEN", adminNote: "a".repeat(2000) }), p("d1"));
    expect(ok!.status).toBe(200);
    mockPrisma.dispute.update.mockClear();
    mockAudit.mockClear();
    const long = "a".repeat(2001);
    const r = await json(await disputeOne.PATCH(req("/disputes/d1", "PATCH", { status: "OPEN", adminNote: long }), p("d1")));
    expect(r).toEqual({ status: 400, body: { error: "note_too_long" } });
    expect(await updateDisputeStatusAction("d1", "OPEN", long)).toEqual({ success: false, error: "Errors.invalidData" });
    NO_WRITES();
  });
});

describe("kupon", () => {
  const VALID = { code: "yaz25", discount: 25, isPercent: true, minPrice: null, maxUses: 100, expiresAt: null };
  const BAD: [string, Record<string, unknown>][] = [
    ["kod cok kisa", { ...VALID, code: "ab" }],
    ["kodda bosluk", { ...VALID, code: "YAZ 25" }],
    ["yuzde 100'u asiyor", { ...VALID, discount: 150 }],
    ["indirim sifir", { ...VALID, discount: 0 }],
    ["kota 0", { ...VALID, maxUses: 0 }],
    ["negatif alt sinir", { ...VALID, minPrice: -1 }],
    ["tarih ISO degil", { ...VALID, expiresAt: "yarin" }],
    ["isPercent eksik", { ...VALID, isPercent: undefined }],
  ];

  it.each(BAD)("%s: mobil 400 invalid_data ve web invalid_data, kayit yok", async (_n, input) => {
    const r = await json(await couponsRoot.POST(req("/coupons", "POST", input)));
    expect(r).toEqual({ status: 400, body: { error: "invalid_data" } });
    expect(await createCouponAction(input)).toEqual({ success: false, error: "invalid_data" });
    NO_WRITES();
  });

  it("gecerli kupon 201; kod normalize edilir, denetim kaydi duser", async () => {
    const r = await json(await couponsRoot.POST(req("/coupons", "POST", VALID)));
    expect(r).toEqual({ status: 201, body: { id: "c1", code: "YAZ25" } });
    expect(mockPrisma.coupon.create.mock.calls[0][0].data.code).toBe("YAZ25");
    expect(auditActions()).toEqual(["coupon.create"]);
  });

  it("ayni kod: mobil 409 duplicate_code, web duplicate_code", async () => {
    mockPrisma.coupon.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
    );
    const r = await json(await couponsRoot.POST(req("/coupons", "POST", VALID)));
    expect(r).toEqual({ status: 409, body: { error: "duplicate_code" } });
    expect(await createCouponAction(VALID)).toEqual({ success: false, error: "duplicate_code" });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("acma/kapatma denetlenir; olmayan kupon 404; boolean olmayan 400", async () => {
    expect((await couponOne.PATCH(req("/coupons/c1", "PATCH", { isActive: false }), p("c1")))!.status).toBe(200);
    expect(mockPrisma.coupon.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { isActive: false } });
    await setCouponActiveAction("c1", true);
    expect(auditActions()).toEqual(["coupon.deactivate", "coupon.activate"]);
    expect(revalidatedPaths()).toContain("/admin/coupons");

    mockPrisma.coupon.update.mockClear();
    const bad = await json(await couponOne.PATCH(req("/coupons/c1", "PATCH", { isActive: "false" }), p("c1")));
    expect(bad).toEqual({ status: 400, body: { error: "invalid_data" } });
    mockPrisma.coupon.findUnique.mockResolvedValue(null);
    const gone = await json(await couponOne.PATCH(req("/coupons/zz", "PATCH", { isActive: true }), p("zz")));
    expect(gone).toEqual({ status: 404, body: { error: "not_found" } });
    expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
  });
});

describe("odeme defteri", () => {
  it("salt okunur: hicbir para tablosuna yazmaz, gecersiz durum filtresiz", async () => {
    mockPrisma.paymentLog.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("1200.40") }, _count: 3 })
      .mockResolvedValueOnce({ _sum: { refundedAmount: new Prisma.Decimal("50") } });
    const r = await json(await paymentsRoute.GET(req("/payments?status=DROP_TABLE")));
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ALL");
    expect(r.body.summary).toMatchObject({ capturedAmount: 1200.4, capturedCount: 3, refundedAmount: 50 });
    expect(mockPrisma.paymentLog.findMany.mock.calls[0][0].where).toEqual({});
    expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled();
    expect(mockPrisma.paymentLog.create).not.toHaveBeenCalled();
    expect(mockPrisma.paymentSplit.update).not.toHaveBeenCalled();
  });

  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])(
    "prototip anahtari (%s) 500 vermez, filtresiz sayilir",
    async (status) => {
      const r = await paymentsRoute.GET(req(`/payments?status=${status}`));
      expect(r!.status).toBe(200);
      expect(mockPrisma.paymentLog.findMany.mock.calls[0][0].where).toEqual({});
    },
  );

  it("gecerli durum suzgeci uygulanir", async () => {
    await paymentsRoute.GET(req("/payments?status=FAILED"));
    expect(mockPrisma.paymentLog.findMany.mock.calls[0][0].where).toEqual({ status: "FAILED" });
  });
});

describe("platform ayarlari", () => {
  /** Mobil PUT: hic kaydedilmemis satir (`findUnique` null) icin surum `null`. */
  const put = (values: unknown, extra: Record<string, unknown> = {}) =>
    settingsRoute.PUT(req("/platform-settings", "PUT", { values, expectedUpdatedAt: null, ...extra }));
  const SAVED_AT = new Date("2026-11-20T08:00:00.000Z");
  function savedRow(over: Record<string, unknown> = {}) {
    return {
      ...SETTINGS,
      platformHolidayDates: null,
      minAppVersion: null,
      latestAppVersion: null,
      updatedAt: SAVED_AT,
      ...over,
    };
  }

  it("GET onay isteyebilecek alanlarin TAMAMINI ve surumu bildirir", async () => {
    const r = await json(await settingsRoute.GET(req("/platform-settings")));
    expect(r.body.riskyFields).toEqual([...RISKY_PLATFORM_SETTING_FIELDS]);
    expect(r.body.updatedAt).toBeNull();
  });

  it("gecersiz deger: mobil 400 ve web invalid_data (ayni sema)", async () => {
    const bad = { ...SETTINGS, earlyRefundRatio: 1.5 };
    expect(await json(await put(bad))).toEqual({ status: 400, body: { error: "invalid_data" } });
    expect(await updatePlatformSettingsAction(bad)).toEqual({ success: false, error: "invalid_data" });
    NO_WRITES();
  });

  it("kismi govde (tek alan) 400: eksik alanlar varsayilana cekilmez", async () => {
    expect(await json(await put({ maxStayDays: 10 }))).toEqual({ status: 400, body: { error: "invalid_data" } });
    NO_WRITES();
  });

  it("surum (expectedUpdatedAt) gonderilmeyen mobil PUT 400", async () => {
    const r = await settingsRoute.PUT(req("/platform-settings", "PUT", { values: { ...SETTINGS, maxStayDays: 10 } }));
    expect(await json(r)).toEqual({ status: 400, body: { error: "invalid_data" } });
    NO_WRITES();
  });

  describe("surum kapisi: minAppVersion <= latestAppVersion", () => {
    it.each([
      ["min en yeni yayinin ustunde", "0.4.0", "0.3.3"],
      ["latest bosken min", "0.3.0", ""],
      ["sayisal karsilastirma (0.10.0 > 0.9.0)", "0.10.0", "0.9.0"],
    ])("%s: mobil 400 invalid_version_gate, web invalid_data, yazma yok", async (_n, min, latest) => {
      const values = { ...SETTINGS, minAppVersion: min, latestAppVersion: latest };
      expect(await json(await put(values, { confirmation: min }))).toEqual({
        status: 400,
        body: { error: "invalid_version_gate" },
      });
      expect(await updatePlatformSettingsAction(values)).toEqual({ success: false, error: "invalid_data" });
      NO_WRITES();
    });

    it("esit surum kabul edilir; onay ifadesi YENI min surumun kendisi", async () => {
      const values = { ...SETTINGS, minAppVersion: "0.3.3", latestAppVersion: "0.3.3" };
      const first = await json(await put(values, { confirmation: "ONAYLA" }));
      expect(first.status).toBe(428);
      expect(first.body.phrase).toBe("0.3.3");
      expect(first.body.changes).toEqual([
        { field: "minAppVersion", from: null, to: "0.3.3" },
        { field: "latestAppVersion", from: null, to: "0.3.3" },
      ]);
      expect((await put(values, { confirmation: "0.3.3" }))!.status).toBe(200);
      expect(mockPrisma.platformSettings.create).toHaveBeenCalledTimes(1);
      expect(await updatePlatformSettingsAction(values)).toEqual({ success: true });
    });

    it("yalniz latest degisirse ifade yeni latest", async () => {
      const r = await json(await put({ ...SETTINGS, latestAppVersion: "0.3.4" }));
      expect(r.body.phrase).toBe("0.3.4");
    });
  });

  it.each([
    ["muhur zorunlulugu", { requireSealsOnCheckIn: !SETTINGS.requireSealsOnCheckIn }, "requireSealsOnCheckIn"],
    ["sigorta ucreti", { insuranceFeeTry: SETTINGS.insuranceFeeTry + 5 }, "insuranceFeeTry"],
    ["kapasite azalir", { maxBagsPerSlot: SETTINGS.maxBagsPerSlot - 1 }, "maxBagsPerSlot"],
  ])("%s: yazarak onay olmadan 428 (eski -> yeni ile), yazma yok", async (_n, patch, field) => {
    const r = await json(await put({ ...SETTINGS, ...patch }, { confirmation: "onayla" }));
    expect(r.status).toBe(428);
    expect(r.body.error).toBe("confirmation_required");
    expect(r.body.phrase).toBe("ONAYLA");
    expect(r.body.changes).toEqual([
      { field, from: SETTINGS[field as keyof typeof SETTINGS], to: (patch as Record<string, unknown>)[field] },
    ]);
    NO_WRITES();
  });

  it("kapasite artisi risksiz", async () => {
    expect((await put({ ...SETTINGS, maxBagsPerSlot: SETTINGS.maxBagsPerSlot + 1 }))!.status).toBe(200);
  });

  describe("tatil gunu", () => {
    const day = (offsetDays: number) =>
      new Date(Date.now() + 3 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
    it.each([
      ["bugun", 0],
      ["6 gun sonra", 6],
    ])("%s eklemek onay ister", async (_n, off) => {
      const r = await json(await put({ ...SETTINGS, platformHolidayDates: [day(off)] }));
      expect(r.status).toBe(428);
      expect(r.body.changes[0].field).toBe("platformHolidayDates");
    });
    it.each([
      ["30 gun sonra", 30],
      ["gecmis bir gun", -3],
    ])("%s eklemek risksiz", async (_n, off) => {
      expect((await put({ ...SETTINGS, platformHolidayDates: [day(off)] }))!.status).toBe(200);
    });
  });

  it("dogru ifadeyle riskli degisiklik yazilir; denetim ve onbellekler", async () => {
    const r = await put(
      { ...SETTINGS, requireSealsOnCheckIn: !SETTINGS.requireSealsOnCheckIn },
      { confirmation: "ONAYLA" },
    );
    expect(r!.status).toBe(200);
    expect(mockPrisma.platformSettings.create).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "platform_settings.update", metadata: { riskyChanged: ["requireSealsOnCheckIn"] } }),
    );
    expect(mockInvalidatePricing).toHaveBeenCalledTimes(1);
    expect(mockInvalidateAppVersion).toHaveBeenCalledTimes(1);
  });

  describe("eszamanlilik", () => {
    it("arada baskasi kaydettiyse 409 stale_settings, yazma yok", async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue(savedRow());
      const r = await json(await put({ ...SETTINGS, maxStayDays: 10 }, { expectedUpdatedAt: "2026-11-01T00:00:00.000Z" }));
      expect(r).toEqual({ status: 409, body: { error: "stale_settings" } });
      expect(mockPrisma.platformSettings.updateMany).not.toHaveBeenCalled();
    });

    it("okuma ile yazma arasindaki yaris da 409 (kosullu yazma 0 satir)", async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue(savedRow());
      mockPrisma.platformSettings.updateMany.mockResolvedValue({ count: 0 });
      const r = await json(await put({ ...SETTINGS, maxStayDays: 10 }, { expectedUpdatedAt: SAVED_AT.toISOString() }));
      expect(r).toEqual({ status: 409, body: { error: "stale_settings" } });
      expect(mockPrisma.platformSettings.updateMany.mock.calls[0][0].where).toEqual({ id: "default", updatedAt: SAVED_AT });
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("guncel surumle yazilir", async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue(savedRow());
      const r = await put({ ...SETTINGS, maxStayDays: 10 }, { expectedUpdatedAt: SAVED_AT.toISOString() });
      expect(r!.status).toBe(200);
      expect(mockPrisma.platformSettings.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  it("web formu onay ve surum adimi tasimaz; upsert, onbellekler ve revalidate", async () => {
    expect(
      await updatePlatformSettingsAction({ ...SETTINGS, requireSealsOnCheckIn: !SETTINGS.requireSealsOnCheckIn }),
    ).toEqual({ success: true });
    expect(mockPrisma.platformSettings.upsert).toHaveBeenCalledTimes(1);
    expect(auditActions()).toEqual(["platform_settings.update"]);
    expect(mockInvalidatePricing).toHaveBeenCalledTimes(1);
    expect(mockInvalidateAppVersion).toHaveBeenCalledTimes(1);
    expect(revalidatedPaths()).toEqual(expect.arrayContaining(["/admin/platform-settings", "/admin"]));
  });
});

describe("ozellik bayraklari", () => {
  const BODY = { enabled: false, rolloutPct: 100, allowedUserIds: [], description: "x" };

  it("liste her bayragi `risky` ile isaretler", async () => {
    mockPrisma.featureFlag.findMany.mockResolvedValue([
      { key: "mobile_security_menu", enabled: true, rolloutPct: 100, allowedUserIds: null, description: null, updatedAt: new Date() },
      { key: "online_payments", enabled: false, rolloutPct: 0, allowedUserIds: ["u1"], description: null, updatedAt: new Date() },
    ]);
    const r = await json(await flagsList.GET(req("/feature-flags")));
    expect(r.body.items.map((f: { key: string; risky: boolean }) => [f.key, f.risky])).toEqual([
      ["mobile_security_menu", false],
      ["online_payments", true],
    ]);
    expect(r.body.items[1].allowedUserIds).toEqual(["u1"]);
  });

  it.each([
    "coupon_v2",
    "dynamic_price",
    "late_fee_v2",
    "booking_flow_v3",
    "maintenance_mode",
    "kill_switch_search",
    "signup_flow",
    "register_v2",
    "login_banner",
  ])("%s riskli sayilir (anahtar onayi ister)", async (key) => {
    const r = await json(await flagOne.PATCH(req(`/feature-flags/${key}`, "PATCH", BODY), p(key)));
    expect(r).toEqual({ status: 428, body: { error: "confirmation_required" } });
  });

  it("yazma bayrak onbellegini bosaltir: sonraki okuma veritabanina gider", async () => {
    mockPrisma.featureFlag.findMany.mockResolvedValue([]);
    await featureFlagService.isEnabled("mobile_security_menu", {});
    await featureFlagService.isEnabled("mobile_security_menu", {});
    expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledTimes(1);
    await flagOne.PATCH(req("/feature-flags/mobile_security_menu", "PATCH", BODY), p("mobile_security_menu"));
    await featureFlagService.isEnabled("mobile_security_menu", {});
    expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledTimes(2);
  });

  it("web bayrak action'i revalidate eder", async () => {
    await updateFeatureFlagAction({ key: "mobile_security_menu", ...BODY });
    expect(revalidatedPaths()).toEqual(expect.arrayContaining(["/admin/feature-flags", "/admin"]));
  });

  it("riskli bayrak anahtari yazilmadan 428", async () => {
    const r = await json(
      await flagOne.PATCH(req("/feature-flags/online_payments", "PATCH", { ...BODY, confirmation: "evet" }), p("online_payments")),
    );
    expect(r).toEqual({ status: 428, body: { error: "confirmation_required" } });
    NO_WRITES();
  });

  it("riskli bayrak anahtarla onaylaninca yazilir ve denetlenir", async () => {
    const r = await flagOne.PATCH(
      req("/feature-flags/online_payments", "PATCH", { ...BODY, confirmation: "online_payments" }),
      p("online_payments"),
    );
    expect(r!.status).toBe(200);
    expect(mockPrisma.featureFlag.upsert.mock.calls[0][0].update).toMatchObject({ enabled: false, rolloutPct: 100 });
    expect(auditActions()).toEqual(["feature_flag.update"]);
  });

  it("risksiz bayrak onaysiz yazilir", async () => {
    const r = await flagOne.PATCH(req("/feature-flags/mobile_security_menu", "PATCH", BODY), p("mobile_security_menu"));
    expect(r!.status).toBe(200);
  });

  it("mobil yalniz var olan bayragi duzenler (404); web upsert'i korunur", async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
    const r = await json(await flagOne.PATCH(req("/feature-flags/yeni_bayrak", "PATCH", BODY), p("yeni_bayrak")));
    expect(r).toEqual({ status: 404, body: { error: "not_found" } });
    expect(mockPrisma.featureFlag.upsert).not.toHaveBeenCalled();
    expect(await updateFeatureFlagAction({ key: "yeni_bayrak", ...BODY })).toEqual({ success: true });
  });

  it("gecersiz yuzde: mobil 400 ve web invalid_data", async () => {
    const bad = { ...BODY, rolloutPct: 101 };
    const r = await json(await flagOne.PATCH(req("/feature-flags/mobile_security_menu", "PATCH", bad), p("mobile_security_menu")));
    expect(r).toEqual({ status: 400, body: { error: "invalid_data" } });
    expect(await updateFeatureFlagAction({ key: "mobile_security_menu", ...bad })).toEqual({ success: false, error: "invalid_data" });
    NO_WRITES();
  });
});
