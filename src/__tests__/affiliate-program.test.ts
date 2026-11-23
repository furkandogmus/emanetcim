import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";

/**
 * ARACI PROGRAMI -- atif, tek indirim kurali, komisyon ve odeme.
 *
 * Kurallar `AffiliateService` / `CheckoutDiscountService`te; bu dosya onlari
 * davranisla sabitler: pasif kod yok sayilir, kendine komisyon yok, komisyon
 * yalnizca check-out'ta ve rezervasyonun KOPYA oraniyla dogar, indirim tek.
 */

const m = vi.hoisted(() => {
  const tx = {
    shop: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    booking: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    affiliateCommission: { createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      affiliate: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
      affiliateClickDay: { upsert: vi.fn(), groupBy: vi.fn() },
      affiliateCommission: { groupBy: vi.fn(), findMany: vi.fn() },
      booking: { findUnique: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
      shop: { findUnique: vi.fn() },
      user: { findFirst: vi.fn(), findUnique: vi.fn() },
      $transaction: vi.fn(async (f: (t: typeof tx) => unknown) => f(tx)),
    },
    coupon: { preview: vi.fn(), claim: vi.fn(), release: vi.fn() },
    referral: { resolveDiscount: vi.fn(), check: vi.fn() },
    notify: vi.fn(),
    audit: vi.fn(),
    refund: { value: 0 },
  };
});

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: { notifyAdminsForAffiliateApplication: m.notify },
}));
vi.mock("@/services/CouponService", () => ({ couponService: m.coupon }));
vi.mock("@/services/ReferralService", async (orig) => ({
  ...(await orig<typeof import("@/services/ReferralService")>()),
  referralService: m.referral,
}));
vi.mock("@/services/ShopScheduleService", () => ({
  findClosedStayDay: vi.fn().mockResolvedValue(null),
  isClosedAtStayTimes: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn(async () => ({
    maxStayDays: 30,
    maxBagsPerSlot: 50,
    insuranceFeeTry: 0,
    defaultPricePerDay: 50,
    platformHolidayDates: [],
    latePickupGraceMin: 15,
    latePickupFeeTry: 0,
    bagMultipliers: { S: 1, M: 1, XL: 1 },
  })),
}));
vi.mock("@/lib/qr-token", () => ({ createQrToken: vi.fn(async () => "qr") }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: { record: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/services/SealService", () => ({ sealService: { applyCheckOutReturnSealsWithinTx: vi.fn() } }));
vi.mock("@/services/PricingService", () => ({ pricingService: { calculateEarlyRefund: () => m.refund.value } }));

import {
  adminCreateAffiliate,
  adminMarkCommissionsPaid,
  adminUpdateAffiliate,
  affiliateService,
  applyAffiliateGuestDiscount,
  monthRange,
  normalizeAffiliateCode,
  percentOf,
  suggestAffiliateCode,
  unpaidCommissionsCsv,
} from "@/services/AffiliateService";
import { checkoutDiscountService } from "@/services/CheckoutDiscountService";
import { createInitialBooking } from "@/services/booking/create";
import { checkOut } from "@/services/booking/check-out";

const D = (v: number | string) => new Prisma.Decimal(v);

function affiliateRow(over: Record<string, unknown> = {}) {
  return {
    id: "aff-1",
    code: "AHMET-EV",
    status: "ACTIVE",
    userId: "aff-user",
    contactEmail: "host@example.test",
    commissionRate: D(10),
    guestDiscountRate: D(0),
    user: { email: "host-account@example.test" },
    ...over,
  };
}

const ADMIN = { id: "admin-1", role: "ADMIN" as const };

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.$transaction.mockImplementation(async (f: (t: typeof m.tx) => unknown) => f(m.tx));
  m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow());
  m.prisma.user.findUnique.mockResolvedValue({ email: "misafir@example.test", phone: null });
  m.referral.resolveDiscount.mockResolvedValue(null);
  m.referral.check.mockResolvedValue({ ok: false, reason: "invalid_code" });
  m.coupon.preview.mockResolvedValue({ ok: false, reason: "invalid" });
  m.coupon.claim.mockResolvedValue({ ok: false });
  m.notify.mockResolvedValue(undefined);
});

describe("kod bicimi", () => {
  it("buyuk/kucuk harf ve bosluk ayni kod; gecersiz bicim null", () => {
    expect(normalizeAffiliateCode(" ahmet-ev ")).toBe("AHMET-EV");
    expect(normalizeAffiliateCode("A")).toBeNull();
    expect(normalizeAffiliateCode("-AHMET")).toBeNull();
    expect(normalizeAffiliateCode("AH--MET")).toBeNull();
    expect(normalizeAffiliateCode("AHMET EV")).toBeNull();
    expect(normalizeAffiliateCode(42)).toBeNull();
  });

  it("addan okunur kod onerir (Turkce harfler katlanir)", () => {
    expect(suggestAffiliateCode("Ahmet'in Evi")).toBe("AHMET-IN-EVI");
    expect(suggestAffiliateCode("Şişli Güneş Otel")).toBe("SISLI-GUNES-OTEL");
    expect(suggestAffiliateCode("!")).toBe("ARACI");
  });
});

describe("atif cozumleme", () => {
  it("ACTIVE kod atif verir ve oranlari Decimal tasir", async () => {
    const r = await affiliateService.resolve("ahmet-ev", { userId: "misafir" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.attribution.affiliateId).toBe("aff-1");
      expect(r.attribution.commissionRate.toNumber()).toBe(10);
    }
    expect(m.prisma.affiliate.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: "AHMET-EV" } }));
  });

  it.each(["PENDING", "PAUSED"])("%s kod yok sayilir (bilinmeyen kodla ayni cevap)", async (status) => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ status }));
    expect(await affiliateService.resolve("AHMET-EV", { userId: "misafir" })).toEqual({ ok: false, reason: "invalid_code" });
  });

  it("aracinin kendi hesabi atif almaz", async () => {
    expect(await affiliateService.resolve("AHMET-EV", { userId: "aff-user" })).toEqual({ ok: false, reason: "own_code" });
  });

  it("girisli misafir: hesabin e-postasi ya da telefonu araciyla ayniysa atif yok (ikinci hesap)", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ email: "Host@Example.test", phone: null });
    expect(await affiliateService.resolve("AHMET-EV", { userId: "ikinci-hesap" })).toEqual({ ok: false, reason: "own_code" });
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ contactPhone: "+90 532 000 00 00" }));
    m.prisma.user.findUnique.mockResolvedValue({ email: "baska@example.test", phone: "05320000000" });
    expect(await affiliateService.resolve("AHMET-EV", { userId: "ikinci-hesap" })).toEqual({ ok: false, reason: "own_code" });
    m.prisma.user.findUnique.mockResolvedValue({ email: "baska@example.test", phone: null });
    expect(await affiliateService.resolve("AHMET-EV", { guestPhone: "0532 000 00 00" })).toEqual({ ok: false, reason: "own_code" });
    expect((await affiliateService.resolve("AHMET-EV", { userId: "ikinci-hesap" })).ok).toBe(true);
  });

  it("hesapsiz odemede aracinin kendi e-postasi atif almaz", async () => {
    for (const email of ["HOST@example.test", "host-account@example.test"]) {
      expect(await affiliateService.resolve("AHMET-EV", { guestEmail: email })).toEqual({ ok: false, reason: "own_code" });
    }
  });
});

describe("link tiklamasi", () => {
  it("aktif kodda gunluk sayaci artirir; kisi bilgisi yazmaz", async () => {
    expect(await affiliateService.recordClick("ahmet-ev", new Date("2026-11-23T22:30:00Z"))).toBe("AHMET-EV");
    const arg = m.prisma.affiliateClickDay.upsert.mock.calls[0][0];
    // 22:30 UTC = Istanbul'da ertesi gun.
    expect(arg.where.affiliateId_day.day.toISOString()).toBe("2026-11-24T00:00:00.000Z");
    expect(arg.update).toEqual({ count: { increment: 1 } });
    expect(JSON.stringify(arg)).not.toMatch(/ip|agent|email/i);
  });

  it("durdurulmus kod sayilmaz ve cerez icin kod donmez", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ status: "PAUSED" }));
    expect(await affiliateService.recordClick("AHMET-EV")).toBeNull();
    expect(m.prisma.affiliateClickDay.upsert).not.toHaveBeenCalled();
  });
});

describe("tek indirim kurali", () => {
  it("araci indirimi sunucuda, Decimal ve 2 haneyle hesaplanir", () => {
    expect(applyAffiliateGuestDiscount(333.33, 10)).toEqual({ discountAmount: 33.33, totalPrice: 300 });
    expect(percentOf("199.99", "12.5").toFixed(2)).toBe("25.00");
  });

  it("kupon daha buyukse kupon uygulanir, araci yine atfedilir", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ guestDiscountRate: D(5) }));
    m.coupon.preview.mockResolvedValue({ ok: true, code: "YAZ20", discountAmount: 20, totalPrice: 80 });
    m.coupon.claim.mockResolvedValue({ ok: true, claimed: { couponId: "c1", code: "YAZ20", discountAmount: 20, totalPrice: 80 } });
    const r = await checkoutDiscountService.claim({ subtotal: 100, couponCode: "YAZ20", affiliateCode: "AHMET-EV", guest: { userId: "g" } });
    expect(r).toMatchObject({ totalPrice: 80, couponDiscountAmount: 20, affiliateDiscountAmount: 0, affiliateCode: "AHMET-EV" });
  });

  it("araci indirimi buyukse kupon kotasi HIC alinmaz ve indirimler toplanmaz", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ guestDiscountRate: D(15) }));
    m.coupon.preview.mockResolvedValue({ ok: true, code: "YAZ10", discountAmount: 10, totalPrice: 90 });
    m.referral.resolveDiscount.mockResolvedValue({ code: "DAVET123", discountAmount: 5, totalPrice: 95 });
    const r = await checkoutDiscountService.claim({
      subtotal: 100,
      couponCode: "YAZ10",
      referralCode: "DAVET123",
      affiliateCode: "AHMET-EV",
      guest: { userId: "g" },
    });
    expect(m.coupon.claim).not.toHaveBeenCalled();
    expect(r).toMatchObject({ totalPrice: 85, affiliateDiscountAmount: 15, couponDiscountAmount: 0, referralDiscountAmount: 0 });
  });

  it("esitlikte araci indirimi (kupon kotasi yanmaz)", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ guestDiscountRate: D(10) }));
    m.coupon.preview.mockResolvedValue({ ok: true, code: "ON", discountAmount: 10, totalPrice: 90 });
    const r = await checkoutDiscountService.claim({ subtotal: 100, couponCode: "ON", affiliateCode: "AHMET-EV", guest: { userId: "g" } });
    expect(m.coupon.claim).not.toHaveBeenCalled();
    expect(r.totalPrice).toBe(90);
    expect(r.affiliateDiscountAmount).toBe(10);
  });

  it("onizleme ayni karari verir ve kodu `not_combinable` isaretler", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ guestDiscountRate: D(15) }));
    m.coupon.preview.mockResolvedValue({ ok: true, code: "YAZ10", discountAmount: 10, totalPrice: 90 });
    const q = await checkoutDiscountService.preview({ subtotal: 100, code: "YAZ10", affiliateCode: "AHMET-EV", guest: { userId: "g" } });
    expect(q).toMatchObject({
      total: 85,
      discount: { kind: "affiliate", code: "AHMET-EV", amount: 15 },
      codeStatus: "not_combinable",
      affiliate: { status: "applied", ratePct: 15, amount: 15 },
    });
  });

  it.each([
    // [ad, kupon tutari | null, davet tutari | null, araci %, beklenen toplam]
    ["kupon 10 + davet + araci 15", 10, 5, 15, 85],
    ["kupon gecersiz + davet 20 + araci 15", null, 20, 15, 80],
    ["kupon 20 + araci 15", 20, null, 15, 80],
    ["yalniz davet 5", null, 5, 0, 95],
  ] as const)("onizleme ile rezervasyon AYNI toplami verir: %s", async (_n, couponAmt, refAmt, affPct, expected) => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ guestDiscountRate: D(affPct) }));
    m.coupon.preview.mockResolvedValue(
      couponAmt == null ? { ok: false, reason: "invalid" } : { ok: true, code: "YAZ", discountAmount: couponAmt, totalPrice: 100 - couponAmt },
    );
    m.coupon.claim.mockResolvedValue(
      couponAmt == null ? { ok: false } : { ok: true, claimed: { couponId: "c1", code: "YAZ", discountAmount: couponAmt, totalPrice: 100 - couponAmt } },
    );
    m.referral.check.mockResolvedValue(refAmt == null ? { ok: false, reason: "invalid_code" } : { ok: true, code: "DAVET", discountPct: refAmt });
    const input = { subtotal: 100, couponCode: "YAZ", referralCode: "DAVET", affiliateCode: affPct ? "AHMET-EV" : null, guest: { userId: "g" } };
    const q = await checkoutDiscountService.preview(input);
    const r = await checkoutDiscountService.claim(input);
    expect(q.total).toBe(expected);
    expect(r.totalPrice).toBe(expected);
  });

  it("araci indirimi yoksa (oran 0) eski kural aynen: kupon claim edilir", async () => {
    m.coupon.claim.mockResolvedValue({ ok: true, claimed: { couponId: "c1", code: "YAZ10", discountAmount: 10, totalPrice: 90 } });
    const r = await checkoutDiscountService.claim({ subtotal: 100, couponCode: "YAZ10", affiliateCode: "AHMET-EV", guest: { userId: "g" } });
    expect(m.coupon.preview).not.toHaveBeenCalled();
    expect(r).toMatchObject({ totalPrice: 90, couponId: "c1", affiliateCode: "AHMET-EV" });
  });

  it("kendi kodu ya da pasif kod: ne indirim ne atif", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ guestDiscountRate: D(10) }));
    const own = await checkoutDiscountService.claim({ subtotal: 100, affiliateCode: "AHMET-EV", guest: { userId: "aff-user" } });
    expect(own).toMatchObject({ totalPrice: 100, affiliateDiscountAmount: 0, affiliateCode: undefined });
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ guestDiscountRate: D(10), status: "PAUSED" }));
    const paused = await checkoutDiscountService.preview({ subtotal: 100, affiliateCode: "AHMET-EV", guest: { userId: "g" } });
    expect(paused).toMatchObject({ total: 100, discount: null, affiliate: { status: "invalid" } });
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;
const STAY_DAY = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);
const BOOKING_INPUT = {
  guestId: "misafir",
  shopId: "shop-1",
  totalPrice: 90,
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  checkInTime: new Date(`${STAY_DAY}T09:00:00Z`),
  checkOutTime: new Date(`${STAY_DAY}T18:00:00Z`),
};

describe("rezervasyon olusturma atfi yazar (tasiyici degil)", () => {
  beforeEach(() => {
    m.prisma.shop.findUnique.mockResolvedValue({ isPrelaunch: false });
    m.tx.shop.findUnique.mockResolvedValue({ id: "shop-1", capacity: 10, pricePerDay: D(50) });
    m.tx.booking.findMany.mockResolvedValue([]);
    m.tx.booking.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "b1", ...data }));
    m.tx.booking.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "b1", ...data }));
  });

  it("aktif koddan atif + o anki oranlarin kopyasi + indirim tutari", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ commissionRate: D(12), guestDiscountRate: D(10) }));
    await createInitialBooking({ ...BOOKING_INPUT, affiliateCode: "ahmet-ev", affiliateDiscountAmount: 10 });
    const data = m.tx.booking.create.mock.calls[0][0].data;
    expect(data.affiliateId).toBe("aff-1");
    expect(Number(data.affiliateCommissionRate)).toBe(12);
    expect(Number(data.affiliateGuestDiscountRate)).toBe(10);
    expect(data.affiliateDiscountAmount).toBe(10);
  });

  it("aracinin kendi rezervasyonu atifsiz yazilir", async () => {
    await createInitialBooking({ ...BOOKING_INPUT, guestId: "aff-user", affiliateCode: "AHMET-EV" });
    expect(m.tx.booking.create.mock.calls[0][0].data.affiliateId).toBeNull();
  });

  it("durdurulmus kod atifsiz yazilir", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ status: "PAUSED" }));
    await createInitialBooking({ ...BOOKING_INPUT, affiliateCode: "AHMET-EV" });
    expect(m.tx.booking.create.mock.calls[0][0].data.affiliateId).toBeNull();
  });
});

describe("komisyon yalnizca tamamlanan rezervasyonda", () => {
  const checkedIn = {
    id: "b1",
    status: "CHECKED_IN",
    bookingRowVersion: 1,
    checkOutTime: new Date(Date.now() + DAY_MS),
    totalPrice: D("249.90"),
    affiliateId: "aff-1",
    affiliateCommissionRate: D(10),
  };

  beforeEach(() => {
    m.tx.booking.updateMany.mockResolvedValue({ count: 1 });
    m.refund.value = 0;
  });

  it("erken teslim iadesi komisyon tabanindan duser (taban 0'in altina inmez)", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(checkedIn);
    m.refund.value = 49.9;
    await checkOut("b1");
    const row = m.tx.affiliateCommission.createMany.mock.calls[0][0].data[0];
    expect(row.baseAmount.toFixed(2)).toBe("200.00");
    expect(row.amount.toFixed(2)).toBe("20.00");
    vi.clearAllMocks();
    m.tx.booking.updateMany.mockResolvedValue({ count: 1 });
    m.refund.value = 999;
    await checkOut("b1");
    const zero = m.tx.affiliateCommission.createMany.mock.calls[0][0].data[0];
    expect(zero.baseAmount.toFixed(2)).toBe("0.00");
    expect(zero.amount.toFixed(2)).toBe("0.00");
  });

  it("yonetici zorla teslimi komisyon YAZMAZ (urun karari)", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(checkedIn);
    expect(await checkOut("b1", { forced: { note: "misafir dukkana geldi" } })).toMatchObject({ ok: true });
    expect(m.tx.affiliateCommission.createMany).not.toHaveBeenCalled();
  });

  it("check-out: tutar = odenen toplam x KOPYA oran, 2 hane", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(checkedIn);
    // Aracinin bugunku orani 25: kopya (10) kullanilmali.
    m.prisma.affiliate.findUnique.mockResolvedValue(affiliateRow({ commissionRate: D(25) }));
    expect(await checkOut("b1")).toMatchObject({ ok: true });
    const row = m.tx.affiliateCommission.createMany.mock.calls[0][0];
    expect(row.skipDuplicates).toBe(true);
    expect(row.data[0]).toMatchObject({ affiliateId: "aff-1", bookingId: "b1" });
    expect(row.data[0].amount.toFixed(2)).toBe("24.99");
    expect(row.data[0].rate.toNumber()).toBe(10);
  });

  it("atifsiz rezervasyon satir uretmez", async () => {
    m.prisma.booking.findUnique.mockResolvedValue({ ...checkedIn, affiliateId: null, affiliateCommissionRate: null });
    await checkOut("b1");
    expect(m.tx.affiliateCommission.createMany).not.toHaveBeenCalled();
  });

  it.each(["CANCELLED", "APPROVED"])("%s rezervasyon teslim edilemez, komisyon dogmaz", async (status) => {
    m.prisma.booking.findUnique.mockResolvedValue({ ...checkedIn, status });
    expect(await checkOut("b1")).toMatchObject({ ok: false, code: "INVALID_STATUS" });
    expect(m.tx.affiliateCommission.createMany).not.toHaveBeenCalled();
  });

  it("iptal / gelmedi / suresi dolma yollari komisyon defterine hic dokunmaz", () => {
    // Tek yazici check-out: kapanis ve iptal dosyalari defteri anmiyor.
    const root = path.join(process.cwd(), "src");
    const writers: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) {
          if (f.name !== "__tests__") walk(p);
        } else if (/\.tsx?$/.test(f.name)) {
          const src = fs.readFileSync(p, "utf8");
          if (/recordCommissionWithinTx\(/.test(src) || /affiliateCommission\.(create|upsert)/.test(src)) {
            writers.push(path.relative(root, p));
          }
        }
      }
    };
    walk(root);
    expect(writers.sort()).toEqual(["services/AffiliateService.ts", "services/booking/check-out.ts"]);
  });
});

describe("yonetim: oran/durum denetimi, odeme, CSV", () => {
  const existing = {
    id: "aff-1",
    code: "AHMET-EV",
    displayName: "Ahmet",
    type: "AIRBNB_HOST",
    status: "PENDING",
    userId: null,
    commissionRate: D(10),
    guestDiscountRate: D(0),
  };
  const form = { displayName: "Ahmet", type: "airbnb_host", code: "ahmet-ev", commissionRate: 12, guestDiscountRate: 5, status: "active" };

  it("onay + oran degisikligi ayri denetim kaydi birakir", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue(existing);
    m.prisma.affiliate.update.mockResolvedValue({});
    expect(await adminUpdateAffiliate(ADMIN, "aff-1", form)).toEqual({ ok: true });
    const actions = m.audit.mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(["affiliate.rate_change", "affiliate.status_change"]);
    expect(m.audit.mock.calls[0][0].metadata).toMatchObject({ commissionRate: { from: 10, to: 12 } });
  });

  it("oran %50 ustu reddedilir; cakisan kod duplicate_code", async () => {
    expect(await adminCreateAffiliate(ADMIN, { ...form, commissionRate: 80 })).toEqual({ ok: false, reason: "invalid_data" });
    m.prisma.affiliate.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7", meta: { target: ["code"] } }),
    );
    expect(await adminCreateAffiliate(ADMIN, form)).toEqual({ ok: false, reason: "duplicate_code" });
  });

  it("ay odemesi yalnizca UNPAID satirlari kapatir, referans ve tutari denetime yazar", async () => {
    m.tx.affiliateCommission.findMany.mockResolvedValue([
      { id: "c1", amount: D("24.99") },
      { id: "c2", amount: D("10.01") },
    ]);
    m.tx.affiliateCommission.updateMany.mockResolvedValue({ count: 2 });
    const r = await adminMarkCommissionsPaid(ADMIN, { month: "2026-11", reference: "HAVALE-1" });
    expect(r).toEqual({ ok: true, count: 2, total: 35 });
    const where = m.tx.affiliateCommission.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("UNPAID");
    expect(where.earnedAt.gte.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(m.tx.affiliateCommission.updateMany.mock.calls[0][0].where.status).toBe("UNPAID");
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "affiliate.payout", metadata: expect.objectContaining({ reference: "HAVALE-1", total: 35 }) }));
  });

  it("ay araligi Turkiye saatiyle; gecersiz ay null", () => {
    expect(monthRange("2026-12")!.to.toISOString()).toBe("2026-12-31T21:00:00.000Z");
    expect(monthRange("2026-13")).toBeNull();
  });

  it("CSV formul enjeksiyonuna kapali ve misafir alani tasimaz", async () => {
    m.prisma.affiliateCommission.findMany.mockResolvedValue([
      {
        baseAmount: D(100),
        rate: D(10),
        amount: D(10),
        earnedAt: new Date("2026-11-10T10:00:00Z"),
        affiliate: { code: "AHMET-EV", displayName: "=HYPERLINK(1)", contactEmail: null, contactPhone: null },
        booking: { checkInTime: new Date("2026-11-10T08:00:00Z"), shop: { name: "Ornek Dukkan" } },
      },
    ]);
    const csv = await unpaidCommissionsCsv({ month: "2026-11" });
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
    expect(csv).toContain(`"10.00"`);
    const select = m.prisma.affiliateCommission.findMany.mock.calls[0][0].select;
    expect(JSON.stringify(select.booking)).not.toMatch(/guest/i);
  });
});

describe("araci paneli misafir verisi gostermez", () => {
  it("yalnizca tarih, dukkan, tutar ve komisyon secer", async () => {
    m.prisma.affiliate.findUnique.mockResolvedValue({
      id: "aff-1",
      code: "AHMET-EV",
      displayName: "Ahmet",
      status: "ACTIVE",
      commissionRate: D(10),
      guestDiscountRate: D(0),
    });
    m.prisma.affiliateClickDay.groupBy.mockResolvedValue([{ affiliateId: "aff-1", _sum: { count: 7 } }]);
    m.prisma.booking.groupBy.mockResolvedValue([
      { affiliateId: "aff-1", status: "CHECKED_OUT", _count: { _all: 2 } },
      { affiliateId: "aff-1", status: "CANCELLED", _count: { _all: 1 } },
    ]);
    m.prisma.affiliateCommission.groupBy.mockResolvedValue([
      { affiliateId: "aff-1", status: "UNPAID", _sum: { amount: D("12.50") } },
      { affiliateId: "aff-1", status: "PAID", _sum: { amount: D("7.50") } },
    ]);
    m.prisma.booking.findMany.mockResolvedValue([
      {
        checkInTime: new Date("2026-11-10T08:00:00Z"),
        status: "CHECKED_OUT",
        totalPrice: D(125),
        shop: { name: "Ornek Dukkan" },
        affiliateCommission: { amount: D("12.50"), status: "UNPAID" },
      },
    ]);
    const panel = await affiliateService.getPanelForUser("aff-user");
    expect(panel!.stats).toEqual({ clicks: 7, bookings: 3, completedBookings: 2, earned: 20, unpaid: 12.5, paid: 7.5 });
    const select = m.prisma.booking.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(["affiliateCommission", "checkInTime", "shop", "status", "totalPrice"]);
    expect(JSON.stringify(panel!.bookings)).not.toMatch(/guest|email|phone|qrCode|"id"/i);
  });
});

describe("Araci ol basvurusu", () => {
  it("PENDING kayit acar ve yoneticiye haber verir", async () => {
    m.prisma.affiliate.create.mockResolvedValue({ id: "aff-9", code: "ORNEK-OTEL" });
    const r = await affiliateService.submitApplication({ displayName: "Ornek Otel", type: "hotel", contactEmail: "otel@example.test" });
    expect(r).toEqual({ ok: true, id: "aff-9" });
    expect(m.prisma.affiliate.create.mock.calls[0][0].data).toMatchObject({ status: "PENDING", code: "ORNEK-OTEL", type: "HOTEL" });
    expect(m.notify).toHaveBeenCalled();
  });

  it("iletisim bilgisi olmadan kabul edilmez", async () => {
    expect(await affiliateService.submitApplication({ displayName: "Ornek", type: "guide" })).toEqual({ ok: false, reason: "invalid_data" });
  });
});
