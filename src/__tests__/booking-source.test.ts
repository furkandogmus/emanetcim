import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Afis atfi ve kanal istatistigi. Atif yalniz istatistik; yine de imza, pencere ve dukkan
 * dogrulanir ki elle yazilan cerez ya da istemci alani sayiyi sisiremesin.
 */
const h = vi.hoisted(() => ({
  prisma: {
    shop: { findUnique: vi.fn() },
    booking: { count: vi.fn(), groupBy: vi.fn() },
    appLinkHit: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: h.prisma }));
vi.mock("@/lib/app-stores", async (orig) => ({
  ...(await orig<typeof import("@/lib/app-stores")>()),
  getAppStoreFlags: vi.fn(async () => ({ iosAppStoreLive: false, androidPlayLive: false })),
}));
vi.mock("@/lib/internal-api-guard", () => ({ isRateLimited: vi.fn(async () => false) }));

process.env.AUTH_SECRET ??= crypto.randomUUID() + crypto.randomUUID();

import {
  POSTER_ATTRIBUTION_WINDOW_MS,
  POSTER_COOKIE,
  clientPosterAttribution,
  posterShopIdFromAppLinkSource,
  signPosterAttribution,
  verifyPosterAttribution,
} from "@/lib/booking-source";
import { bookingSourceService } from "@/services/BookingSourceService";
import { GET as appLink } from "@/app/app/route";

const SHOP = "0b7e3c1a-2f4d-4c8e-9a1b-3d5e7f9a1b2c";
const T0 = new Date("2026-11-25T10:00:00Z");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

beforeEach(() => vi.clearAllMocks());

describe("afis etiketi", () => {
  it("yalniz afis-<uuid> dukkan kimligi verir", () => {
    expect(posterShopIdFromAppLinkSource(`afis-${SHOP}`)).toBe(SHOP);
    expect(posterShopIdFromAppLinkSource("afis-shop00000001")).toBeNull();
    expect(posterShopIdFromAppLinkSource("web-home")).toBeNull();
    expect(posterShopIdFromAppLinkSource(null)).toBeNull();
  });
});

describe("web cerezi (imzali, 30 dk, son dokunus)", () => {
  it("pencere icinde gecerli, disinda gecersiz", () => {
    const v = signPosterAttribution(SHOP, T0);
    expect(verifyPosterAttribution(v, new Date(T0.getTime() + 29 * 60 * 1000))).toBe(SHOP);
    expect(verifyPosterAttribution(v, new Date(T0.getTime() + POSTER_ATTRIBUTION_WINDOW_MS + 1000))).toBeNull();
  });

  it("degistirilmis dukkan ya da imza reddedilir", () => {
    const v = signPosterAttribution(SHOP, T0);
    const other = "11111111-2222-4333-8444-555555555555";
    expect(verifyPosterAttribution(v.replace(SHOP, other), T0)).toBeNull();
    expect(verifyPosterAttribution(`${v}x`, T0)).toBeNull();
    expect(verifyPosterAttribution("garbage", T0)).toBeNull();
    expect(verifyPosterAttribution(undefined, T0)).toBeNull();
  });

  it("son dokunus: yeni okutma eskisinin yerini alir (cerez ustune yazilir)", () => {
    const other = "11111111-2222-4333-8444-555555555555";
    const later = new Date(T0.getTime() + 10 * 60 * 1000);
    expect(verifyPosterAttribution(signPosterAttribution(other, later), later)).toBe(other);
  });
});

describe("uygulama atfi (imzasiz, dogrulanir)", () => {
  it("bicim ve pencere", () => {
    const at = (ms: number) => new Date(T0.getTime() + ms).toISOString();
    expect(clientPosterAttribution({ shopId: SHOP, capturedAt: at(-10 * 60 * 1000) }, T0)).toBe(SHOP);
    expect(clientPosterAttribution({ shopId: SHOP, capturedAt: at(-31 * 60 * 1000) }, T0)).toBeNull();
    // Ileri tarihli damga (saat oynatma) tolere edilmez.
    expect(clientPosterAttribution({ shopId: SHOP, capturedAt: at(10 * 60 * 1000) }, T0)).toBeNull();
    expect(clientPosterAttribution({ shopId: "not-a-uuid", capturedAt: at(0) }, T0)).toBeNull();
    expect(clientPosterAttribution({ shopId: SHOP, capturedAt: 123 }, T0)).toBeNull();
    expect(clientPosterAttribution(null, T0)).toBeNull();
  });

  it("dukkan yoksa / pasifse / test ise atif dusurulur", async () => {
    h.prisma.shop.findUnique.mockResolvedValueOnce({ id: SHOP, isActive: true, isTest: false });
    expect(await bookingSourceService.resolvePosterShop(SHOP)).toBe(SHOP);
    h.prisma.shop.findUnique.mockResolvedValueOnce(null);
    expect(await bookingSourceService.resolvePosterShop(SHOP)).toBeNull();
    h.prisma.shop.findUnique.mockResolvedValueOnce({ id: SHOP, isActive: false, isTest: false });
    expect(await bookingSourceService.resolvePosterShop(SHOP)).toBeNull();
    h.prisma.shop.findUnique.mockResolvedValueOnce({ id: SHOP, isActive: true, isTest: true });
    expect(await bookingSourceService.resolvePosterShop(SHOP)).toBeNull();
    expect(await bookingSourceService.resolvePosterShop(null)).toBeNull();
  });
});

describe("/app afis cerezi", () => {
  it("afis-<uuid> okutulunca imzali cerez yazilir", async () => {
    const res = await appLink(new NextRequest(`https://bagajpark.com/app?kaynak=afis-${SHOP}`, { headers: { "user-agent": IPHONE } }));
    const cookie = res.cookies.get(POSTER_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(verifyPosterAttribution(cookie?.value)).toBe(SHOP);
  });

  it("magaza kapaliyken gecerli dukkanin rezervasyon sayfasina iner, yoksa acilis sayfasi", async () => {
    h.prisma.shop.findUnique.mockResolvedValueOnce({ id: SHOP, isActive: true, isTest: false });
    const res = await appLink(new NextRequest(`https://bagajpark.com/app?kaynak=afis-${SHOP}`, { headers: { "user-agent": IPHONE } }));
    expect(res.headers.get("location")).toBe(`https://bagajpark.com/tr/shop/${SHOP}?kaynak=afis-${SHOP}`);
    h.prisma.shop.findUnique.mockResolvedValueOnce(null);
    const gone = await appLink(new NextRequest(`https://bagajpark.com/app?kaynak=afis-${SHOP}`, { headers: { "user-agent": IPHONE } }));
    expect(gone.headers.get("location")).toBe(`https://bagajpark.com/tr/app?kaynak=afis-${SHOP}`);
  });

  it("baska kaynakta ve botta cerez yok", async () => {
    const home = await appLink(new NextRequest("https://bagajpark.com/app?kaynak=web-home", { headers: { "user-agent": IPHONE } }));
    expect(home.cookies.get(POSTER_COOKIE)).toBeUndefined();
    const bot = await appLink(new NextRequest(`https://bagajpark.com/app?kaynak=afis-${SHOP}`, { headers: { "user-agent": "Googlebot/2.1" } }));
    expect(bot.cookies.get(POSTER_COOKIE)).toBeUndefined();
  });
});

describe("istatistik", () => {
  it("dukkan: afis atfi sourceShopId ile, kapidan gelen dukkanla; iptaller sayilmaz", async () => {
    h.prisma.booking.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const s = await bookingSourceService.shopStats(SHOP, "Europe/Istanbul", T0);
    expect(s).toEqual({ thisMonth: { poster: 4, walkIn: 2 }, lastMonth: { poster: 1, walkIn: 0 } });
    const [poster, walkIn, prevPoster] = h.prisma.booking.count.mock.calls.map((c) => c[0].where);
    expect(poster).toMatchObject({ sourceShopId: SHOP, source: "poster", status: { not: "CANCELLED" } });
    expect(walkIn).toMatchObject({ shopId: SHOP, source: "walk_in" });
    // Istanbul'da Kasim basi = 31 Ekim 21:00 UTC.
    expect(poster.createdAt.gte.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(prevPoster.createdAt.lt.toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });

  it("yonetici dagilimi: bilinmeyen kanal unknown kovasina", async () => {
    h.prisma.booking.groupBy.mockResolvedValueOnce([
      { source: "web", _count: { _all: 3 } },
      { source: "bogus", _count: { _all: 1 } },
      { source: null, _count: { _all: 2 } },
    ]);
    expect(await bookingSourceService.breakdown(30, T0)).toEqual({ web: 3, app: 0, walk_in: 0, poster: 0, unknown: 3 });
  });
});
