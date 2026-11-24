import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Talep testi kotuye kullanim sinirlari (2026-11-24).
 *
 * - "Haber ver" girissiz ve her kayit teyit e-postasi atiyor: IP kovasi, bal
 *   kupu, gecici adres engeli ve adres basina gunluk e-posta tavani.
 * - "Burada olsun" sayaci `bp_anon` cerezi silinerek sisirilebiliyordu: IP +
 *   nokta basina gunde bir sayim.
 */

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  notify: vi.fn(),
  shopFind: vi.fn(),
  interestCreate: vi.fn(),
  wantCreate: vi.fn(),
  wantCount: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: vi.fn().mockResolvedValue("203.0.113.7") }));
vi.mock("@/lib/anon-visitor", () => ({ ensureAnonVisitorId: vi.fn().mockResolvedValue("anon-1") }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn().mockResolvedValue("tr") }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/AnalyticsService", () => ({ analyticsService: { track: vi.fn() } }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: { notifyPrelaunchInterestReceived: m.notify },
}));
vi.mock("@/lib/db", () => ({
  default: {
    shop: { findUnique: m.shopFind },
    prelaunchInterest: { create: m.interestCreate },
    prelaunchWant: { create: m.wantCreate, count: m.wantCount },
  },
}));

import { registerPrelaunchInterestAction, registerPrelaunchWantAction } from "@/actions/prelaunch";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";

const SHOP = "11111111-1111-4111-8111-111111111111";
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(true);
  m.notify.mockResolvedValue(undefined);
  m.shopFind.mockResolvedValue({ isPrelaunch: true, name: "Nokta" });
  m.interestCreate.mockResolvedValue({ id: "i1" });
  m.wantCreate.mockResolvedValue({});
  m.wantCount.mockResolvedValue(4);
});

describe("registerPrelaunchInterestAction", () => {
  it("bal kupu dolu: basari gibi doner, kayit ve e-posta yok", async () => {
    const res = await registerPrelaunchInterestAction({
      shopId: SHOP,
      email: "misafir@example.com",
      hp_field: "http://spam.invalid",
    });
    expect(res).toEqual({ success: true, alreadyRegistered: false });
    expect(m.interestCreate).not.toHaveBeenCalled();
    expect(m.rateLimit).not.toHaveBeenCalled();
  });

  it("IP kovasi dolunca tooManyRequests, servis cagrilmaz", async () => {
    m.rateLimit.mockResolvedValueOnce(false);
    const res = await registerPrelaunchInterestAction({ shopId: SHOP, email: "misafir@example.com" });
    expect(res).toEqual({ success: false, error: "Errors.tooManyRequests" });
    expect(m.rateLimit).toHaveBeenCalledWith("prelaunch_interest_ip:203.0.113.7", 5, 10 * 60_000);
    expect(m.interestCreate).not.toHaveBeenCalled();
  });

  it("gecici adres kayit yazmaz", async () => {
    const res = await registerPrelaunchInterestAction({ shopId: SHOP, email: "x@mailinator.com" });
    expect(res).toEqual({ success: false, error: "Errors.invalidEmail" });
    expect(m.interestCreate).not.toHaveBeenCalled();
  });
});

describe("PrelaunchInterestService.record: adres basina e-posta tavani", () => {
  it("tavan icinde teyit gonderilir", async () => {
    await prelaunchInterestService.record({ shopId: SHOP, email: "Misafir+tag@Example.com" });
    await flush();
    expect(m.rateLimit).toHaveBeenCalledWith("prelaunch_confirm_email:misafir@example.com", 3, 24 * 60 * 60_000);
    expect(m.notify).toHaveBeenCalledOnce();
  });

  it("tavan dolunca kayit yazilir ama e-posta gitmez", async () => {
    m.rateLimit.mockResolvedValue(false);
    const res = await prelaunchInterestService.record({ shopId: SHOP, email: "misafir@example.com" });
    await flush();
    expect(res).toEqual({ ok: true, alreadyRegistered: false });
    expect(m.interestCreate).toHaveBeenCalledOnce();
    expect(m.notify).not.toHaveBeenCalled();
  });
});

describe("mailboxQuotaKey", () => {
  it("+etiket atilir; gmail/googlemail noktalari da", async () => {
    const { mailboxQuotaKey } = await import("@/lib/disposable-emails");
    expect(mailboxQuotaKey("A.b+x@Example.com")).toBe("a.b@example.com");
    expect(mailboxQuotaKey("a.b.c+1@gmail.com")).toBe("abc@gmail.com");
    expect(mailboxQuotaKey("a.b.c@googlemail.com")).toBe("abc@gmail.com");
  });
});

describe("registerPrelaunchWantAction: IP + nokta basina gunde bir sayim", () => {
  it("ilk tik sayilir", async () => {
    const res = await registerPrelaunchWantAction({ shopId: SHOP });
    expect(res).toEqual({ success: true, alreadyCounted: false, count: 4 });
    expect(m.rateLimit).toHaveBeenCalledWith(`prelaunch_want_ip:203.0.113.7:${SHOP}`, 1, 24 * 60 * 60_000);
    expect(m.wantCreate).toHaveBeenCalledOnce();
  });

  it("cerez silinip tekrar tiklaninca sayac artmaz, hata da gosterilmez", async () => {
    m.rateLimit.mockResolvedValue(false);
    const res = await registerPrelaunchWantAction({ shopId: SHOP });
    expect(res).toEqual({ success: true, alreadyCounted: true, count: 4 });
    expect(m.wantCreate).not.toHaveBeenCalled();
  });
});
