import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFlags, mockRecord, mockLimited, mockCreate } = vi.hoisted(() => ({
  mockFlags: vi.fn(),
  mockRecord: vi.fn(),
  mockLimited: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/app-stores", async (orig) => ({
  ...(await orig<typeof import("@/lib/app-stores")>()),
  getAppStoreFlags: mockFlags,
}));
vi.mock("@/services/AppLinkService", async (orig) => ({
  ...(await orig<typeof import("@/services/AppLinkService")>()),
  recordAppLinkHit: mockRecord,
}));
vi.mock("@/lib/internal-api-guard", () => ({ isRateLimited: mockLimited }));
const { mockGroupBy, mockDeleteMany } = vi.hoisted(() => ({ mockGroupBy: vi.fn(), mockDeleteMany: vi.fn() }));
vi.mock("@/lib/db", () => ({
  default: { appLinkHit: { create: mockCreate, groupBy: mockGroupBy, deleteMany: mockDeleteMany } },
}));

import { GET } from "@/app/app/route";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";

function req(qs: string, ua: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://bagajpark.com/app${qs}`, { headers: { "user-agent": ua, ...headers } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLimited.mockResolvedValue(false);
  mockRecord.mockResolvedValue(undefined);
});

describe("GET /app", () => {
  it("bayraklar kapali: iPhone bile acilis sayfasina (yonlendirme yok), kaynak kaydedilir", async () => {
    mockFlags.mockResolvedValue({ iosAppStoreLive: false, androidPlayLive: false });
    const res = await GET(req("?kaynak=afis-shop00000001", IPHONE));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://bagajpark.com/tr/app?kaynak=afis-shop00000001");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(mockRecord).toHaveBeenCalledWith({ source: "afis-shop00000001", platform: "ios", outcome: "landing" });
  });

  it("iOS yayinda: iPhone App Store'a", async () => {
    mockFlags.mockResolvedValue({ iosAppStoreLive: true, androidPlayLive: false });
    const res = await GET(req("?kaynak=web-home", IPHONE));
    expect(res.headers.get("location")).toBe("https://apps.apple.com/tr/app/id6838203193");
    expect(mockRecord).toHaveBeenCalledWith({ source: "web-home", platform: "ios", outcome: "redirect" });
  });

  it("Play yayinda degilken Android acilis sayfasina, yayindayken Play'e", async () => {
    mockFlags.mockResolvedValue({ iosAppStoreLive: true, androidPlayLive: false });
    let res = await GET(req("?utm_source=instagram", ANDROID));
    expect(res.headers.get("location")).toBe("https://bagajpark.com/tr/app?kaynak=instagram");

    mockFlags.mockResolvedValue({ iosAppStoreLive: true, androidPlayLive: true });
    res = await GET(req("?utm_source=instagram", ANDROID));
    expect(res.headers.get("location")).toBe("https://play.google.com/store/apps/details?id=com.bagajpark");
    expect(mockRecord).toHaveBeenLastCalledWith({ source: "instagram", platform: "android", outcome: "redirect" });
  });

  it("dili cerezden, yoksa Accept-Language'dan secer", async () => {
    mockFlags.mockResolvedValue({ iosAppStoreLive: false, androidPlayLive: false });
    let res = await GET(req("", "Mozilla/5.0 (X11; Linux x86_64) Firefox/133.0", { "accept-language": "de-DE,de;q=0.9" }));
    expect(res.headers.get("location")).toBe("https://bagajpark.com/de/app");
    res = await GET(req("", "Mozilla/5.0 (X11; Linux x86_64) Firefox/133.0", { cookie: "NEXT_LOCALE=en" }));
    expect(res.headers.get("location")).toBe("https://bagajpark.com/en/app");
  });

  it("bot: yanit verir ama kaydetmez", async () => {
    mockFlags.mockResolvedValue({ iosAppStoreLive: true, androidPlayLive: true });
    const res = await GET(req("?kaynak=x", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
    expect(res.status).toBe(302);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("hiz siniri asilinca ya da sinirlayici hata verince yine yonlendirir, kaydetmez", async () => {
    mockFlags.mockResolvedValue({ iosAppStoreLive: true, androidPlayLive: false });
    mockLimited.mockResolvedValue(true);
    let res = await GET(req("", IPHONE));
    expect(res.headers.get("location")).toBe("https://apps.apple.com/tr/app/id6838203193");
    mockLimited.mockRejectedValue(new Error("redis down"));
    res = await GET(req("", IPHONE));
    expect(res.status).toBe(302);
    expect(mockRecord).not.toHaveBeenCalled();
  });
});

describe("recordAppLinkHit", () => {
  it("veritabani hatasini yutar (yonlendirme bozulmaz)", async () => {
    const real = (await vi.importActual<typeof import("@/services/AppLinkService")>("@/services/AppLinkService"))
      .recordAppLinkHit;
    mockCreate.mockRejectedValue(new Error("db down"));
    await expect(real({ source: "x", platform: "ios", outcome: "landing" })).resolves.toBeUndefined();
    mockCreate.mockResolvedValue({});
    await real({ source: "x", platform: "other", outcome: "landing" });
    expect(mockCreate).toHaveBeenLastCalledWith({ data: { source: "x", platform: "other", outcome: "landing" } });
  });
});

describe("isabet ozeti ve saklama", () => {
  it("en buyuk 50 grup, kalani tek toplam", async () => {
    const { getAppLinkStats } = await import("@/services/AppLinkService");
    mockGroupBy.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({
        source: `afis-shop${String(i).padStart(4, "0")}`,
        platform: "ios",
        outcome: "landing",
        _count: { _all: 100 - i },
      })),
    );
    const { rows, restCount } = await getAppLinkStats(30);
    expect(rows).toHaveLength(50);
    expect(rows[0].count).toBe(100);
    // 51..60. gruplar: 50+49+...+41
    expect(restCount).toBe(455);
  });

  it("90 gunden eskiyi siler", async () => {
    const { purgeOldAppLinkHits } = await import("@/services/AppLinkService");
    mockDeleteMany.mockResolvedValue({ count: 7 });
    const now = new Date("2026-11-23T00:00:00Z");
    expect(await purgeOldAppLinkHits(now)).toBe(7);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date("2026-08-25T00:00:00Z") } } });
  });
});
