import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Kimliksiz onizlemeler e-posta almaz (2026-11-23). Hesapsiz checkout kalkinca
 * `guestEmail` parametresi yalnizca "bu e-postanin gecmis rezervasyonu var mi"
 * sorusunu disaridan sordurmaya yariyordu.
 */
const m = vi.hoisted(() => ({ check: vi.fn(), preview: vi.fn(), auth: vi.fn(), cookie: vi.fn() }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/action-auth", () => ({ requireUser: vi.fn(), assertAdmin: vi.fn(), actionSession: () => m.auth() }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  getClientIpOrNull: vi.fn().mockResolvedValue("127.0.0.1"),
}));
vi.mock("@/services/ReferralService", () => ({ referralService: { check: m.check } }));
vi.mock("@/services/CheckoutDiscountService", () => ({ checkoutDiscountService: { preview: m.preview } }));
vi.mock("@/lib/db", () => ({ default: { shop: { findUnique: vi.fn().mockResolvedValue({ pricePerDay: 100 }) } } }));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/booking-server-price", () => ({
  computeAuthoritativeCheckoutTotals: () => ({ subtotalBeforeCoupon: 300 }),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: m.cookie })) }));

import { validateReferralCodeAction } from "@/actions/referral";
import { previewAffiliateCheckoutAction } from "@/actions/affiliate";

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue(null);
  m.check.mockResolvedValue({ ok: true, code: "ABCD2345", discountPct: 5 });
  m.preview.mockResolvedValue({ affiliate: null, total: 300, discount: null });
  m.cookie.mockReturnValue({ value: "AHMET-EV" });
});

describe("e-posta kahini kapali", () => {
  it("davet kodu onizlemesi ikinci argumani (eski guestEmail) servise tasimaz", async () => {
    await (validateReferralCodeAction as (c: string, e?: string) => Promise<unknown>)("ABCD2345", "ada@example.com");
    expect(m.check).toHaveBeenCalledWith("ABCD2345", { userId: undefined });
  });

  it("araci onizlemesi govdedeki guestEmail'i yok sayar", async () => {
    await previewAffiliateCheckoutAction({
      shopId: "11111111-1111-4111-8111-111111111111",
      bagCountS: 1,
      bagCountM: 0,
      bagCountXl: 0,
      checkInTime: new Date("2030-01-01T10:00:00Z"),
      checkOutTime: new Date("2030-01-03T10:00:00Z"),
      guestEmail: "ada@example.com",
    });
    expect(m.preview).toHaveBeenCalledWith(expect.objectContaining({ guest: { userId: undefined } }));
  });
});
