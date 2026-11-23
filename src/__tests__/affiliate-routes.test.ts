import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Araci tasiyicilari: `/r/<kod>` (cerez, son tiklama, acik yonlendirme yok),
 * yonetim uclarinin yetki kapisi ve odemenin kodu servise iletmesi.
 */

const m = vi.hoisted(() => ({
  recordClick: vi.fn(),
  requireMobileUser: vi.fn(),
  auth: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  payout: vi.fn(),
  csv: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: m.requireMobileUser,
}));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/client-ip", async (orig) => ({
  ...(await orig<typeof import("@/lib/client-ip")>()),
  getClientIp: vi.fn(async () => "127.0.0.1"),
  getClientIpOrNull: vi.fn(async () => null),
}));
vi.mock("@/services/AffiliateService", async (orig) => {
  const real = await orig<typeof import("@/services/AffiliateService")>();
  return {
    ...real,
    affiliateService: { recordClick: m.recordClick },
    listAffiliatesForAdmin: m.list,
    adminCreateAffiliate: m.create,
    adminUpdateAffiliate: m.update,
    adminMarkCommissionsPaid: m.payout,
    unpaidCommissionsCsv: m.csv,
  };
});

import { GET as linkGET } from "@/app/[locale]/r/[code]/route";
import { safeAffiliateRedirectPath } from "@/lib/affiliate-link";
import * as adminRoot from "@/app/api/mobile/admin/affiliates/route";
import * as adminOne from "@/app/api/mobile/admin/affiliates/[id]/route";
import * as adminPayouts from "@/app/api/mobile/admin/affiliates/payouts/route";
import { GET as csvGET } from "@/app/api/admin/affiliates/commissions/route";
import { createAffiliateAction, markAffiliateCommissionsPaidAction, updateAffiliateAction } from "@/actions/affiliate";

const click = (code: string, query = "", locale = "tr") =>
  linkGET(new NextRequest(`https://bagajpark.com/${locale}/r/${code}${query}`), {
    params: Promise.resolve({ locale, code }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(true);
  m.recordClick.mockImplementation(async (c: string) => (c.toUpperCase() === "AHMET-EV" || c.toUpperCase() === "OTEL-X" ? c.toUpperCase() : null));
});

describe("/r/<kod>", () => {
  it("aktif kod: 30 gunluk HttpOnly, SameSite=Lax cerez ve ana sayfaya 302", async () => {
    const r = await click("ahmet-ev");
    expect(r.status).toBe(302);
    // `aff=` (davet kodunun `ref=`'inden ayri): uygulama baglantisi kodu tasir.
    expect(r.headers.get("location")).toBe("/tr?aff=AHMET-EV");
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^bp_aff=AHMET-EV/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/);
  });

  it("son tiklama kazanir: ikinci link cerezi yeni kodla ezer", async () => {
    await click("ahmet-ev");
    const second = await click("otel-x");
    expect(second.headers.get("set-cookie")).toMatch(/^bp_aff=OTEL-X/);
  });

  it("pasif / bilinmeyen kod: cerez yok ama misafir yine siteye gelir", async () => {
    const r = await click("YOK-BOYLE");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/tr");
    expect(r.headers.get("set-cookie")).toBeNull();
  });

  it("?to= site ici yol: dil oneki korunur ya da eklenir", async () => {
    expect((await click("ahmet-ev", "?to=/en/search?city=istanbul")).headers.get("location")).toBe("/en/search?city=istanbul&aff=AHMET-EV");
    expect((await click("ahmet-ev", "?to=/tr/shop/abc", "de")).headers.get("location")).toBe("/tr/shop/abc?aff=AHMET-EV");
    expect((await click("ahmet-ev", "?to=/shop/abc", "de")).headers.get("location")).toBe("/de/shop/abc?aff=AHMET-EV");
  });

  it("IP siniri asildiysa tiklama sayilmaz ama misafir yonlenir ve cerez yazilir", async () => {
    m.rateLimit.mockResolvedValue(false);
    const r = await click("ahmet-ev");
    expect(m.recordClick).toHaveBeenCalledWith("ahmet-ev", expect.any(Date), { count: false });
    expect(r.status).toBe(302);
    expect(r.headers.get("set-cookie")).toMatch(/^bp_aff=AHMET-EV/);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/%0d%0aSet-Cookie:x=1",
    "/tr/../../etc",
    " /tr",
    "/\tevil",
  ])("acik yonlendirme yok: %s", (to) => {
    const path = safeAffiliateRedirectPath(to, "tr");
    expect(path.startsWith("/")).toBe(true);
    expect(path.startsWith("//")).toBe(false);
    expect(path).not.toMatch(/evil|javascript|\\|\r|\n/);
  });

  it("bilinmeyen dil varsayilana duser", () => {
    expect(safeAffiliateRedirectPath(null, "xx")).toBe("/tr");
  });
});

const ADMIN = { id: "a1", role: "ADMIN" as const, email: "a@example.test" };
const mreq = (path: string, method = "GET", body?: unknown) =>
  new NextRequest(`https://bagajpark.com/api/mobile/admin${path}`, {
    method,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

const ROUTES: [string, () => Promise<Response | undefined>][] = [
  ["GET affiliates", () => adminRoot.GET(mreq("/affiliates"))],
  ["POST affiliates", () => adminRoot.POST(mreq("/affiliates", "POST", {}))],
  ["PATCH affiliates/:id", () => adminOne.PATCH(mreq("/affiliates/x", "PATCH", {}), p("x"))],
  ["POST affiliates/payouts", () => adminPayouts.POST(mreq("/affiliates/payouts", "POST", {}))],
];

describe("yonetim uclari yetki kapisi", () => {
  it.each(ROUTES)("%s: yonetici olmayan 403, servis cagrilmaz", async (_n, call) => {
    for (const role of ["GUEST", "PARTNER"]) {
      m.requireMobileUser.mockResolvedValue({ user: { ...ADMIN, role } });
      const r = await call();
      expect(r!.status).toBe(403);
    }
    m.requireMobileUser.mockResolvedValue({ user: { ...ADMIN, role: "PARTNER", impersonatedBy: "a0" } });
    expect((await call())!.status).toBe(403);
    for (const fn of [m.list, m.create, m.update, m.payout]) expect(fn).not.toHaveBeenCalled();
  });

  it("yonetici: liste DTO'dan, odeme sonucu sayi", async () => {
    m.requireMobileUser.mockResolvedValue({ user: ADMIN });
    m.list.mockResolvedValue([]);
    expect(await (await adminRoot.GET(mreq("/affiliates")))!.json()).toEqual({ items: [] });
    m.payout.mockResolvedValue({ ok: true, count: 2, total: 35 });
    const r = await adminPayouts.POST(mreq("/affiliates/payouts", "POST", { month: "2026-11", reference: "R1" }));
    expect(await r!.json()).toEqual({ count: 2, total: 35 });
    expect(m.payout).toHaveBeenCalledWith(ADMIN, { month: "2026-11", reference: "R1" }, expect.anything());
  });

  it("CSV: oturumsuz ve yonetici olmayan 401", async () => {
    const r = new NextRequest("https://bagajpark.com/api/admin/affiliates/commissions");
    m.auth.mockResolvedValue(null);
    expect((await csvGET(r)).status).toBe(401);
    m.auth.mockResolvedValue({ user: { id: "u", role: "PARTNER" } });
    expect((await csvGET(r)).status).toBe(401);
    expect(m.csv).not.toHaveBeenCalled();
    m.auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    m.csv.mockResolvedValue("﻿h");
    const ok = await csvGET(new NextRequest("https://bagajpark.com/api/admin/affiliates/commissions?month=2026-11"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toMatch(/text\/csv/);
    expect(m.csv).toHaveBeenCalledWith({ month: "2026-11" });
  });
});

describe("web yonetim action'lari", () => {
  it.each([
    ["create", () => createAffiliateAction({})],
    ["update", () => updateAffiliateAction("x", {})],
    ["payout", () => markAffiliateCommissionsPaidAction({})],
  ] as const)("%s: yonetici olmayan reddedilir, servis cagrilmaz", async (_n, call) => {
    for (const session of [null, { user: { id: "u", role: "GUEST" } }, { user: { id: "u", role: "PARTNER" } }]) {
      m.auth.mockResolvedValue(session);
      await expect(call()).rejects.toThrow();
    }
    for (const fn of [m.create, m.update, m.payout]) expect(fn).not.toHaveBeenCalled();
  });
});
