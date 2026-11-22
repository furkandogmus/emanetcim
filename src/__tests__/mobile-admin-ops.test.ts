import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil yonetim araclari: uyusmazlik, kupon, odeme defteri, platform ayari, bayrak.
 * Her kural iki taraftan olculur: mobil uc ve web action AYNI servis govdesinden
 * ayni sonucu almali; yonetici olmayan ve goruntuleme oturumu yazamaz; riskli
 * ayar yazarak onaysiz gecmez; her yazma denetim kaydi birakir.
 */
const { mockPrisma, mockRequireMobileUser, mockAudit, mockAuth } = vi.hoisted(() => ({
  mockPrisma: {
    dispute: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    coupon: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    paymentLog: { findMany: vi.fn(), aggregate: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
    paymentSplit: { aggregate: vi.fn(), update: vi.fn() },
    merchantPaymentAccount: { findMany: vi.fn() },
    platformSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    featureFlag: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  },
  mockRequireMobileUser: vi.fn(),
  mockAudit: vi.fn(),
  mockAuth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAudit }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/client-ip", async (orig) => ({
  ...(await orig<typeof import("@/lib/client-ip")>()),
  getClientIpOrNull: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
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
  ["PUT platform-settings", () => settingsRoute.PUT(req("/platform-settings", "PUT", { values: SETTINGS }))],
  ["GET feature-flags", () => flagsList.GET(req("/feature-flags"))],
  ["PATCH feature-flags/:key", () => flagOne.PATCH(req("/feature-flags/x", "PATCH", {}), p("x"))],
];

const NO_WRITES = () => {
  expect(mockPrisma.dispute.update).not.toHaveBeenCalled();
  expect(mockPrisma.coupon.create).not.toHaveBeenCalled();
  expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
  expect(mockPrisma.platformSettings.upsert).not.toHaveBeenCalled();
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

  it.each(ROUTES)("%s: goruntuleme oturumunda 403 not_allowed_while_impersonating", async (_n, call) => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, impersonatedBy: "a0" } });
    const r = await json(await call());
    expect(r).toEqual({ status: 403, body: { error: "not_allowed_while_impersonating" } });
    NO_WRITES();
  });
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
    expect(r.body.booking.seals[0]).toMatchObject({ sealNumber: 1001, photoUrl: "https://x/p.jpg" });
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

  it("web action da ayni govdeyi kullanir: denetim kaydi birakir", async () => {
    await updateDisputeStatusAction("d1", "IN_REVIEW", "bakiliyor");
    expect(auditActions()).toEqual(["dispute.update_status"]);
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

  it("gecerli durum suzgeci uygulanir", async () => {
    await paymentsRoute.GET(req("/payments?status=FAILED"));
    expect(mockPrisma.paymentLog.findMany.mock.calls[0][0].where).toEqual({ status: "FAILED" });
  });
});

describe("platform ayarlari", () => {
  it("GET her riskli alani ve onay ifadesini bildirir", async () => {
    const r = await json(await settingsRoute.GET(req("/platform-settings")));
    expect(r.body.riskyFields).toEqual(expect.arrayContaining(["requireSealsOnCheckIn", "insuranceFeeTry", "minAppVersion"]));
    expect(r.body.riskyFields).not.toContain("maxStayDays");
    expect(r.body.confirmPhrase).toBe("ONAYLA");
  });

  it("gecersiz deger: mobil 400 ve web invalid_data (ayni sema)", async () => {
    const bad = { ...SETTINGS, earlyRefundRatio: 1.5 };
    const r = await json(await settingsRoute.PUT(req("/platform-settings", "PUT", { values: bad })));
    expect(r).toEqual({ status: 400, body: { error: "invalid_data" } });
    expect(await updatePlatformSettingsAction(bad)).toEqual({ success: false, error: "invalid_data" });
    NO_WRITES();
  });

  it.each([
    ["muhur zorunlulugu", { requireSealsOnCheckIn: !SETTINGS.requireSealsOnCheckIn }, "requireSealsOnCheckIn"],
    ["sigorta ucreti", { insuranceFeeTry: SETTINGS.insuranceFeeTry + 5 }, "insuranceFeeTry"],
    ["minimum surum", { minAppVersion: "0.4.0" }, "minAppVersion"],
  ])("%s yazarak onay olmadan 428, yazma yok", async (_n, patch, field) => {
    const r = await json(
      await settingsRoute.PUT(req("/platform-settings", "PUT", { values: { ...SETTINGS, ...patch }, confirmation: "onayla" })),
    );
    expect(r).toEqual({ status: 428, body: { error: "confirmation_required", fields: [field] } });
    NO_WRITES();
  });

  it("dogru ifadeyle riskli degisiklik yazilir; denetim kaydi degisen alani tasir", async () => {
    const r = await settingsRoute.PUT(
      req("/platform-settings", "PUT", { values: { ...SETTINGS, requireSealsOnCheckIn: !SETTINGS.requireSealsOnCheckIn }, confirmation: "ONAYLA" }),
    );
    expect(r!.status).toBe(200);
    expect(mockPrisma.platformSettings.upsert).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "platform_settings.update", metadata: { riskyChanged: ["requireSealsOnCheckIn"] } }),
    );
  });

  it("risksiz alan onaysiz yazilir", async () => {
    const r = await settingsRoute.PUT(req("/platform-settings", "PUT", { values: { ...SETTINGS, maxStayDays: 10 } }));
    expect(r!.status).toBe(200);
    expect(mockPrisma.platformSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it("web formu yazarak onay adimi tasimaz; davranisi degismedi", async () => {
    expect(await updatePlatformSettingsAction({ ...SETTINGS, requireSealsOnCheckIn: !SETTINGS.requireSealsOnCheckIn })).toEqual({ success: true });
    expect(auditActions()).toEqual(["platform_settings.update"]);
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
