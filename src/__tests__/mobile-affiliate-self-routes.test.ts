import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** Mobil araci paneli ve basvurusu: web ile ayni servis, ayni hiz siniri. */

const m = vi.hoisted(() => ({
  requireMobileUser: vi.fn(),
  getPanel: vi.fn(),
  submit: vi.fn(),
  rateLimit: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/site-base-url", () => ({ getSiteBaseUrl: () => "https://bagajpark.example" }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: m.requireMobileUser,
}));
vi.mock("@/lib/client-ip", async (orig) => ({
  ...(await orig<typeof import("@/lib/client-ip")>()),
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

import { affiliateService } from "@/services/AffiliateService";
import * as meRoute from "@/app/api/mobile/affiliate/me/route";
import * as applyRoute from "@/app/api/mobile/affiliate/apply/route";

const me = { GET: async (r: NextRequest) => (await meRoute.GET(r))! };
const apply = { POST: async (r: NextRequest) => (await applyRoute.POST(r))! };
import { applyAffiliateAction } from "@/actions/affiliate";

const PANEL = {
  code: "ORNEK-EV",
  displayName: "Ornek Ev",
  status: "active",
  commissionRate: 10,
  guestDiscountRate: 5,
  stats: { clicks: 4, bookings: 2, completedBookings: 1, earned: 30, unpaid: 30, paid: 0 },
  bookings: [
    { day: "2026-11-20", shopName: "Dukkan", amount: 300, completed: true, cancelled: false, commission: 30, commissionPaid: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(affiliateService, "getPanelForUser").mockImplementation(m.getPanel);
  vi.spyOn(affiliateService, "submitApplication").mockImplementation(m.submit);
  m.rateLimit.mockResolvedValue(true);
  m.requireMobileUser.mockResolvedValue({ user: { id: "u1", role: "GUEST" } });
});

const req = (url: string, body?: unknown) =>
  new NextRequest(url, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });

describe("GET /api/mobile/affiliate/me", () => {
  it("kaydi olmayana panel null, olana link ve sayaclar", async () => {
    m.getPanel.mockResolvedValue(null);
    expect(await (await me.GET(req("https://x/api/mobile/affiliate/me"))).json()).toEqual({ panel: null });

    m.getPanel.mockResolvedValue(PANEL);
    const { panel } = await (await me.GET(req("https://x/api/mobile/affiliate/me"))).json();
    expect(panel.link).toBe("https://bagajpark.example/r/ORNEK-EV");
    expect(panel.stats.unpaid).toBe(30);
    expect(panel.bookings[0]).toEqual(PANEL.bookings[0]);
    expect(m.getPanel).toHaveBeenCalledWith("u1");
  });

  it("onaylanmamis basvuruda paylasilacak link yok", async () => {
    m.getPanel.mockResolvedValue({ ...PANEL, status: "pending", code: "BASVURU-ABCD1234" });
    const { panel } = await (await me.GET(req("https://x/api/mobile/affiliate/me"))).json();
    expect(panel.link).toBeNull();
  });
});

describe("POST /api/mobile/affiliate/apply", () => {
  const body = { displayName: "Ornek Otel", type: "hotel", contactEmail: "otel@example.test" };

  it("basvuru hesaba baglanir", async () => {
    m.submit.mockResolvedValue({ ok: true, id: "a1" });
    const res = await apply.POST(req("https://x/api/mobile/affiliate/apply", body));
    expect(res.status).toBe(201);
    expect(m.submit).toHaveBeenCalledWith(body, { userId: "u1" });
  });

  it("ikinci basvuru 409, hiz siniri 429, goruntulemede 403", async () => {
    m.submit.mockResolvedValue({ ok: false, reason: "already_applied" });
    expect((await apply.POST(req("https://x/api/mobile/affiliate/apply", body))).status).toBe(409);

    m.rateLimit.mockResolvedValue(false);
    const limited = await apply.POST(req("https://x/api/mobile/affiliate/apply", body));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });

    m.requireMobileUser.mockResolvedValue({ user: { id: "u1", role: "GUEST", impersonatedBy: "a9" } });
    expect((await apply.POST(req("https://x/api/mobile/affiliate/apply", body))).status).toBe(403);
  });

  it("web formu ayni servis kapisindan gecer", async () => {
    m.auth.mockResolvedValue(null);
    m.rateLimit.mockResolvedValue(false);
    const fd = new FormData();
    fd.set("displayName", "Ornek Otel");
    fd.set("type", "hotel");
    await expect(applyAffiliateAction({ status: "idle" }, fd)).resolves.toEqual({
      status: "error",
      error: "Errors.tooManyRequests",
    });
    expect(m.submit).not.toHaveBeenCalled();
  });
});
