import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";

/** Uygulamadaki "QR afisi": web afisinin oturumsuz, kisa omurlu bagi. */
const { mockRequireMobileUser, mockResolve, mockPrisma, mockRateLimit } = vi.hoisted(() => ({
  mockRequireMobileUser: vi.fn(),
  mockResolve: vi.fn(),
  mockPrisma: { shop: { findUnique: vi.fn() } },
  mockRateLimit: vi.fn(),
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/lib/partner-shop", () => ({ resolvePartnerShops: mockResolve }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "203.0.113.7") }));
vi.mock("@/lib/qr-svg", () => ({ qrSvg: vi.fn(async (text: string) => `<svg data-text="${text}"></svg>`) }));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (k: string) => k),
}));

import { GET } from "@/app/api/mobile/partner/poster/route";
import SignedPosterPage from "@/app/[locale]/poster/page";
import { signPosterLinkToken } from "@/lib/poster-link-token";
import PosterTokenScrub from "@/components/app-promo/PosterTokenScrub";

const ORIGINAL = { secret: process.env.AUTH_SECRET, base: process.env.NEXT_PUBLIC_BASE_URL };
beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-poster-route-0123456789";
  process.env.NEXT_PUBLIC_BASE_URL = "https://example.test";
});
afterAll(() => {
  process.env.AUTH_SECRET = ORIGINAL.secret;
  process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL.base;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
  mockResolve.mockResolvedValue({ shops: [{ id: "s1", name: "A" }], activeShop: { id: "s1", name: "A", isActive: true } });
  mockRateLimit.mockResolvedValue(true);
});

const req = (q = "") => new NextRequest(`https://example.test/api/mobile/partner/poster${q}`);

describe("GET partner/poster", () => {
  it("esnafin kendi dukkani icin imzali, kisa omurlu bag doner", async () => {
    const res = (await GET(req("?shop=s1&locale=en")))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.url).toMatch(/^https:\/\/example\.test\/en\/poster\?t=[\w.-]+$/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(mockResolve).toHaveBeenCalledWith("p1", "s1");
  });

  it("webde olmayan dil (ru) varsayilana duser", async () => {
    const body = await (await GET(req("?locale=ru")))!.json();
    expect(body.url).toContain("/tr/poster?t=");
  });

  it("dukkansiz esnafa 404", async () => {
    mockResolve.mockResolvedValue({ shops: [], activeShop: null });
    expect((await GET(req()))!.status).toBe(404);
  });

  it("misafir 403", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { id: "g1", role: "GUEST" } });
    expect((await GET(req()))!.status).toBe(403);
  });
});

describe("/poster?t= sayfasi", () => {
  const params = Promise.resolve({ locale: "tr" });
  const page = (t?: string | string[]) => SignedPosterPage({ params, searchParams: Promise.resolve({ t }) });

  it("gecerli bag web afisinin aynisini cizer (QR kaynagi afis-<dukkan>)", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({ id: "s1", name: "Kose Bakkal" });
    const { token } = await signPosterLinkToken("s1");
    const el = await page(token);
    const html = JSON.stringify(el);
    expect(html).toContain("kaynak=afis-s1");
    expect(html).toContain("Kose Bakkal");
    // Token adres cubugundan silinsin (analitik `location.href` gonderir).
    expect((el as { props: { children: { type: unknown }[] } }).props.children[0].type).toBe(PosterTokenScrub);
  });

  it("bozuk ya da suresi dolmus bag dukkan okumadan uyari gosterir", async () => {
    const el = await page("bozuk");
    expect(JSON.stringify(el)).toContain("posterLinkExpiredTitle");
    expect(mockPrisma.shop.findUnique).not.toHaveBeenCalled();
  });

  it("token'siz ya da dizi token dukkan okumaz", async () => {
    expect(JSON.stringify(await page())).toContain("posterLinkExpiredTitle");
    expect(JSON.stringify(await page(["a", "b"]))).toContain("posterLinkExpiredTitle");
    expect(mockPrisma.shop.findUnique).not.toHaveBeenCalled();
  });

  it("hiz siniri asilinca token dogrulanmaz", async () => {
    mockRateLimit.mockResolvedValue(false);
    const { token } = await signPosterLinkToken("s1");
    const el = await page(token);
    expect(JSON.stringify(el)).toContain("posterRateLimitedTitle");
    expect(mockPrisma.shop.findUnique).not.toHaveBeenCalled();
    expect(mockRateLimit).toHaveBeenCalledWith("poster_link:ip:203.0.113.7", 30, 600_000);
  });
});
