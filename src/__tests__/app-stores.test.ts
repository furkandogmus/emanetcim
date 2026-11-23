import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { platformSettings: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import {
  ANDROID_PLAY_URL,
  IOS_APP_STORE_URL,
  appLinkHref,
  decideAppLink,
  detectAppPlatform,
  getAppStoreFlags,
  invalidateAppStoreFlagsCache,
  isBotUserAgent,
  normalizeAppLinkSource,
  smartAppBannerMetadata,
} from "@/lib/app-stores";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const OFF = { iosAppStoreLive: false, androidPlayLive: false };
const BOTH = { iosAppStoreLive: true, androidPlayLive: true };

beforeEach(() => {
  vi.clearAllMocks();
  invalidateAppStoreFlagsCache();
});

describe("platform tespiti", () => {
  it("iPhone/Android/masaustu", () => {
    expect(detectAppPlatform(IPHONE)).toBe("ios");
    expect(detectAppPlatform(ANDROID)).toBe("android");
    expect(detectAppPlatform(DESKTOP)).toBe("other");
    expect(detectAppPlatform(null)).toBe("other");
  });

  it("botlar ve bos UA sayilmaz", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("WhatsApp/2.23")).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(IPHONE)).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(isBotUserAgent("AdsBot-Google (+http://www.google.com/adsbot.html)")).toBe(true);
  });

  it("CUBOT marka telefon bot sayilmaz", () => {
    expect(
      isBotUserAgent("Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36"),
    ).toBe(false);
    expect(detectAppPlatform("Mozilla/5.0 (Linux; Android 10; CUBOT KINGKONG 7) Chrome/131.0 Mobile")).toBe("android");
  });
});

describe("kaynak etiketi", () => {
  it("kaynak once, sonra utm_source, yoksa direct", () => {
    expect(normalizeAppLinkSource("web-home", "x")).toBe("web-home");
    expect(normalizeAppLinkSource(null, "Instagram")).toBe("instagram");
    expect(normalizeAppLinkSource("", "  ")).toBe("direct");
  });

  it("yalnizca bilinen bicimler; gerisi other", () => {
    expect(normalizeAppLinkSource("email-onay", null)).toBe("email-onay");
    expect(normalizeAppLinkSource("afis-cm3x8k2p40000abcd1234", null)).toBe("afis-cm3x8k2p40000abcd1234");
    expect(normalizeAppLinkSource("ali@example.com", null)).toBe("other");
    expect(normalizeAppLinkSource("random-campaign", null)).toBe("other");
    expect(normalizeAppLinkSource("web-" + "x".repeat(200), null)).toBe("other");
    expect(normalizeAppLinkSource("afis-x", null)).toBe("other");
  });
});

describe("/app karari", () => {
  it("bayraklar kapaliyken herkes acilis sayfasina", () => {
    for (const p of ["ios", "android", "other"] as const) {
      expect(decideAppLink(p, OFF)).toEqual({ outcome: "landing" });
    }
  });

  it("yalnizca kendi magazasi yayindaysa yonlendirir", () => {
    expect(decideAppLink("ios", { iosAppStoreLive: true, androidPlayLive: false })).toEqual({
      outcome: "redirect",
      url: IOS_APP_STORE_URL,
    });
    expect(decideAppLink("android", { iosAppStoreLive: true, androidPlayLive: false })).toEqual({ outcome: "landing" });
    expect(decideAppLink("android", BOTH)).toEqual({ outcome: "redirect", url: ANDROID_PLAY_URL });
    expect(decideAppLink("other", BOTH)).toEqual({ outcome: "landing" });
  });

  it("basili bag uretim adresine gider", () => {
    expect(appLinkHref("afis-abc")).toBe("https://bagajpark.com/app?kaynak=afis-abc");
    expect(appLinkHref("email-onay", "http://localhost:3001/")).toBe("http://localhost:3001/app?kaynak=email-onay");
  });
});

describe("Safari akilli bandi", () => {
  it("iOS yayinda degilken meta yok", () => {
    expect(smartAppBannerMetadata(OFF)).toEqual({});
    expect(smartAppBannerMetadata({ iosAppStoreLive: false, androidPlayLive: true }, "x")).toEqual({});
  });

  it("iOS yayindayken app-id, dukkan sayfasinda app-argument", () => {
    expect(smartAppBannerMetadata(BOTH)).toEqual({ itunes: { appId: "6838203193" } });
    expect(smartAppBannerMetadata(BOTH, "https://bagajpark.com/tr/shop/s1")).toEqual({
      itunes: { appId: "6838203193", appArgument: "https://bagajpark.com/tr/shop/s1" },
    });
  });
});

describe("bayrak okuma", () => {
  it("satir yoksa kapali", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue(null);
    expect(await getAppStoreFlags()).toEqual(OFF);
  });

  it("veritabani hatasinda firlatmaz, kapali doner", async () => {
    mockPrisma.platformSettings.findUnique.mockRejectedValue(new Error("db down"));
    expect(await getAppStoreFlags()).toEqual(OFF);
  });

  it("onbellek: ikinci cagri veritabanina gitmez", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue(BOTH);
    expect(await getAppStoreFlags()).toEqual(BOTH);
    expect(await getAppStoreFlags()).toEqual(BOTH);
    expect(mockPrisma.platformSettings.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("rozetler (ana sayfa / altbilgi)", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const StoreBadges = (await import("@/components/app-promo/StoreBadges")).default;
  const render = (flags: typeof OFF) =>
    renderToStaticMarkup(
      createElement(StoreBadges, {
        flags,
        iosHref: "/app?kaynak=web-home",
        androidHref: "/app?kaynak=web-home",
        labels: { appStore: "App Store", googlePlay: "Google Play" },
      }),
    );

  it("ikisi de kapaliyken hicbir sey cizilmez", () => {
    expect(render(OFF)).toBe("");
  });

  it("yalnizca yayindaki magaza, kaynakli /app bagiyla", () => {
    const html = render({ iosAppStoreLive: false, androidPlayLive: true });
    expect(html).toContain("/badges/google-play-tr.png");
    expect(html).not.toContain("app-store-tr");
    expect(html).toContain('href="/app?kaynak=web-home"');
  });
});
