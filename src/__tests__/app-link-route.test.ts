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
vi.mock("@/lib/db", () => ({ default: { appLinkHit: { create: mockCreate } } }));

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
    const res = await GET(req("?kaynak=afis-s1", IPHONE));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://bagajpark.com/tr/app?kaynak=afis-s1");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(mockRecord).toHaveBeenCalledWith({ source: "afis-s1", platform: "ios", outcome: "landing" });
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
