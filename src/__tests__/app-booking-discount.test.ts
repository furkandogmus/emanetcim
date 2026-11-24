import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";
import { applyAppDiscount, lockedBookingDiscount, normalizeAppDiscountPct } from "@/lib/app-discount";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";
import { toMobileAppPrice } from "@/lib/mobile-dto";
import { RISKY_PLATFORM_SETTING_FIELDS } from "@/lib/admin-risky-settings";

const rules = { ...DEFAULT_PRICING_RULES, appBookingDiscountPct: 10 };

vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn(async () => rules),
}));

const couponPreview = vi.fn();
const couponClaim = vi.fn();
vi.mock("@/services/CouponService", () => ({
  couponService: {
    preview: (...a: unknown[]) => couponPreview(...a),
    claim: (...a: unknown[]) => couponClaim(...a),
  },
}));
vi.mock("@/services/ReferralService", () => ({
  referralService: { check: vi.fn(async () => ({ ok: false, reason: "invalid_code" })) },
}));
vi.mock("@/services/AffiliateService", () => ({
  affiliateService: { resolve: vi.fn() },
  applyAffiliateGuestDiscount: vi.fn(),
}));

const { checkoutDiscountService } = await import("@/services/CheckoutDiscountService");

/** Kupon sahtesi: yuzde 20, uygulandigi tabandan. */
function coupon20(subtotal: number) {
  const discountAmount = Math.round(subtotal * 20) / 100;
  return { discountAmount, totalPrice: Math.round((subtotal - discountAmount) * 100) / 100 };
}

beforeEach(() => {
  rules.appBookingDiscountPct = 10;
  couponPreview.mockReset().mockImplementation(async (code: string, subtotal: number) => ({ ok: true, code, ...coupon20(subtotal) }));
  couponClaim.mockReset().mockImplementation(async (code: string, subtotal: number) => ({
    ok: true,
    claimed: { code, couponId: "c1", ...coupon20(subtotal) },
  }));
});

describe("applyAppDiscount: kurus yuvarlamasi", () => {
  it("250 TL %10 -> 25 indirim, 225 toplam", () => {
    expect(applyAppDiscount(250, 10)).toEqual({ pct: 10, discountAmount: 25, totalPrice: 225 });
  });

  it("yarim kurus yukari yuvarlanir, toplam + indirim = ara toplam", () => {
    // 33,35 * %10 = 3,335 -> 3,34
    const r = applyAppDiscount(33.35, 10);
    expect(r.discountAmount).toBe(3.34);
    expect(r.totalPrice).toBe(30.01);
    expect(Math.round((r.totalPrice + r.discountAmount) * 100)).toBe(3335);
  });

  it("kesirli oran (12,5) kayan nokta artigi uretmez", () => {
    expect(applyAppDiscount(199.99, 12.5)).toEqual({ pct: 12.5, discountAmount: 25, totalPrice: 174.99 });
  });

  it("oran 0, negatif ya da gecersizse indirim yok", () => {
    for (const p of [0, -5, Number.NaN, "10", null]) {
      expect(applyAppDiscount(250, p)).toEqual({ pct: 0, discountAmount: 0, totalPrice: 250 });
    }
  });

  it("ust sinir 50", () => {
    expect(normalizeAppDiscountPct(80)).toBe(50);
  });
});

describe("CheckoutDiscountService: kanal ve kupon siralamasi", () => {
  const guest = { userId: "u1" };

  it("web kanali indirim almaz", async () => {
    const r = await checkoutDiscountService.claim({ subtotal: 250, guest });
    expect(r).toMatchObject({ totalPrice: 250, appDiscountAmount: 0 });
  });

  it("uygulama kanali kuponsuz: %10", async () => {
    const r = await checkoutDiscountService.claim({ subtotal: 250, guest, channel: "app" });
    expect(r).toMatchObject({ totalPrice: 225, appDiscountAmount: 25, appDiscountPct: 10, couponDiscountAmount: 0 });
  });

  it("kupon uygulama indiriminden SONRA kalan tutara uygulanir", async () => {
    const r = await checkoutDiscountService.claim({ subtotal: 250, couponCode: "YAZ20", guest, channel: "app" });
    expect(couponClaim).toHaveBeenCalledWith("YAZ20", 225);
    // 250 -> 225 (uygulama) -> 180 (kupon %20 = 45)
    expect(r).toMatchObject({ totalPrice: 180, appDiscountAmount: 25, couponDiscountAmount: 45, couponCode: "YAZ20" });
  });

  it("oran 0: uygulama da tam fiyat, kupon tam tabandan", async () => {
    rules.appBookingDiscountPct = 0;
    const r = await checkoutDiscountService.claim({ subtotal: 250, couponCode: "YAZ20", guest, channel: "app" });
    expect(couponClaim).toHaveBeenCalledWith("YAZ20", 250);
    expect(r).toMatchObject({ totalPrice: 200, appDiscountAmount: 0, couponDiscountAmount: 50 });
  });

  it("onizleme claim ile ayni tutari verir", async () => {
    const q = await checkoutDiscountService.preview({ subtotal: 250, code: "YAZ20", guest, channel: "app" });
    expect(q.total).toBe(180);
    expect(q.appDiscount).toEqual({ pct: 10, amount: 25 });
    expect(q.discount).toMatchObject({ kind: "coupon", amount: 45 });
  });

  it("onizleme: oran 0 ise `appDiscount` null", async () => {
    rules.appBookingDiscountPct = 0;
    const q = await checkoutDiscountService.preview({ subtotal: 250, guest, channel: "app" });
    expect(q).toMatchObject({ total: 250, appDiscount: null });
  });
});

describe("kilitli indirim ve DTO", () => {
  it("duzenleme/revizyon uygulama indirimini de korur", () => {
    expect(
      lockedBookingDiscount({ couponDiscountAmount: 10, referralDiscountAmount: "0", affiliateDiscountAmount: 0, appDiscountAmount: "25.00" }),
    ).toBe(35);
  });

  it("dukkan detayi uygulama fiyati sunucudan, oran 0 ise null", () => {
    expect(toMobileAppPrice(250, { ...rules, bagMultipliers: { S: 1, M: 1, XL: 1 } })).toEqual({
      pct: 10,
      priceBySize: { s: 225, m: 225, xl: 225 },
    });
    expect(toMobileAppPrice(250, { ...rules, appBookingDiscountPct: 0 })).toBeNull();
  });

  it("oran degisikligi riskli alan (esnaf kazancini dusurur)", () => {
    expect(RISKY_PLATFORM_SETTING_FIELDS).toContain("appBookingDiscountPct");
  });
});

describe("kanal rotadan gelir, istemciden degil", () => {
  const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), "utf-8"));

  it("mobil quote ve intent `channel: \"app\"` gecer, deftere yazar", () => {
    const intent = read("src/app/api/mobile/checkout/intent/route.ts");
    const quote = read("src/app/api/mobile/checkout/quote/route.ts");
    expect(intent).toContain('channel: "app"');
    expect(quote).toContain('channel: "app"');
    expect(intent).toContain("appDiscountAmount: discounts.appDiscountAmount");
    // Istemci semasinda kanal ya da indirim bayragi yok.
    expect(intent).not.toMatch(/channel:\s*z\./);
    expect(quote).not.toMatch(/channel:\s*z\./);
  });

  it("web rezervasyonu kanal gecmez (tam fiyat)", () => {
    expect(read("src/actions/booking.ts")).not.toContain('channel: "app"');
  });
});

describe("erken teslim iadesi odenen fiyattan", async () => {
  const { pricingService } = await import("@/services/PricingService");
  const flat = { ...DEFAULT_PRICING_RULES, earlyRefundRatio: 1, bagMultipliers: { S: 1, M: 1, XL: 1 } };
  // 3 gun planli, 1 gun kullanildi: 2 gun iade. Liste: 3 x 100 = 300.
  const stay = {
    checkInTime: new Date("2026-12-01T10:00:00Z"),
    checkOutTime: new Date("2026-12-04T10:00:00Z"),
    unitPrice: 100,
    bagCountM: 1,
    insuranceFee: 0,
  };
  const out = new Date("2026-12-02T09:00:00Z");
  const refund = (totalPrice: number) => pricingService.calculateEarlyRefund({ ...stay, totalPrice }, out, flat);

  it("indirimsiz: 200", () => expect(refund(300)).toBe(200));
  it("uygulama %10 (270): 180", () => expect(refund(270)).toBe(180));
  it("kupon %20 (240): 160", () => expect(refund(240)).toBe(160));
  it("ikisi birden (300 -> 270 -> 216): 144", () => expect(refund(216)).toBe(144));
  it("liste fiyatindan yuksek eski kayit: oran 1'i asmaz", () => expect(refund(400)).toBe(200));
});

describe("tarihli arama kartinin toplami uygulama fiyati", () => {
  it("total indirimli, fullTotal yalniz indirim varken", async () => {
    const { toMobileStayQuote } = await import("@/lib/mobile-dto");
    const t = { subtotalBeforeCoupon: 250, stayDays: 1, bagCountS: 0, bagCountM: 1, bagCountXl: 0 };
    expect(toMobileStayQuote(t, 10)).toEqual({ total: 225, fullTotal: 250, days: 1, bags: 1 });
    expect(toMobileStayQuote(t, 0)).toEqual({ total: 250, days: 1, bags: 1 });
  });
});

describe("oran iki haneye yuvarlanir (denetim = DB)", () => {
  it("12.345 -> 12.35", async () => {
    const { platformSettingsUpdateSchema } = await import("@/services/PlatformSettingsService");
    const d = DEFAULT_PRICING_RULES;
    const parsed = platformSettingsUpdateSchema.parse({
      ...d,
      bagMultiplierS: d.bagMultipliers.S,
      bagMultiplierM: d.bagMultipliers.M,
      bagMultiplierXl: d.bagMultipliers.XL,
      minAppVersion: "",
      latestAppVersion: "",
      appBookingDiscountPct: 12.345,
    });
    expect(parsed.appBookingDiscountPct).toBe(12.35);
  });
});
