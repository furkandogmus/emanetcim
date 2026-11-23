import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/lib/jwt-audience";
import { Prisma } from "@prisma/client";

/**
 * INCELEME KUM HAVUZU (2026-11-23): `User.reviewSandbox` hesap test dukkanlarini gorur
 * ve rezervasyon yapar; anonim ve gercek kullanici icin hicbir sey degismez.
 * Token'lar gercek (`signAccessToken`), Prisma sahte ama `where`i gercekten uygular.
 */

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

const { matches, ids, SHOPS, USERS } = vi.hoisted(() => {
/** Ufak `where` yorumlayicisi: alan esitligi, `{ in }` ve `OR` (filtrelerin kullandigi kadar). */
function matches(row: Row, where: Where | undefined): boolean {
  for (const [k, v] of Object.entries(where ?? {})) {
    if (k === "OR") {
      if (!(v as Where[]).some((w) => matches(row, w))) return false;
    } else if (v && typeof v === "object" && "in" in v) {
      if (!(v as { in: unknown[] }).in.includes(row[k])) return false;
    } else if (row[k] !== v) {
      return false;
    }
  }
  return true;
}

const ids = {
  real: "11111111-1111-4111-8111-111111111111",
  sandbox: "22222222-2222-4222-8222-222222222222",
  prelaunchSandbox: "33333333-3333-4333-8333-333333333333",
};

const baseShop = {
  name: "Ornek Dukkan",
  isActive: true,
  isTest: false,
  isPrelaunch: false,
  latitude: 41,
  longitude: 29,
  pricePerDay: 100,
  open247: true,
  openingTime: null,
  closingTime: null,
  timezone: "Europe/Istanbul",
  owner: { phone: null },
};
const SHOPS: Row[] = [
  { ...baseShop, id: ids.real },
  { ...baseShop, id: ids.sandbox, isTest: true },
  { ...baseShop, id: ids.prelaunchSandbox, isTest: true, isPrelaunch: true },
];
const USERS: Row[] = [
  { id: "u-real", role: "GUEST", email: null, isBanned: false, tokenVersion: 0, isTest: true, reviewSandbox: false },
  { id: "u-test", role: "GUEST", email: null, isBanned: false, tokenVersion: 0, isTest: false, reviewSandbox: true },
];

  return { matches, ids, SHOPS, USERS };
});

const mocks = vi.hoisted(() => ({ rawSql: [] as string[], create: vi.fn() }));

vi.mock("@/lib/db", () => {
  const byId = (rows: Row[]) => async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null;
  return {
    default: {
      user: { findUnique: byId(USERS) },
      shop: {
        findUnique: byId(SHOPS),
        findFirst: async ({ where }: { where: Where }) => SHOPS.find((r) => matches(r, where)) ?? null,
        findMany: async ({ where }: { where: Where }) => SHOPS.filter((r) => matches(r, where)),
      },
      // PostGIS sorgusunu kaydet ve bellek ici yola dus: sonuc `where` ile suzulur.
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        mocks.rawSql.push(Prisma.sql(strings, ...values).sql);
        throw new Error("no postgis in unit test");
      },
    },
  };
});
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: async () => "1.1.1.1" }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/platform-settings", async () => {
  const { DEFAULT_PRICING_RULES } = await import("@/lib/pricing-rules");
  return { getPricingRules: async () => DEFAULT_PRICING_RULES };
});
vi.mock("@/services/ShopScheduleService", () => ({ loadScheduleParts: vi.fn().mockResolvedValue(new Map()) }));
vi.mock("@/services/ShopGalleryService", () => ({ shopGalleryService: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("@/lib/mobile-dto", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-dto")>()),
  toMobileShop: (s: { id: string }) => ({ id: s.id }),
  toMobilePriceRange: () => ({ min: 1, max: 2, medium: 1 }),
  toMobilePriceBySize: () => ({}),
  toMobilePricing: () => ({}),
}));
vi.mock("@/lib/stay-days", async (orig) => ({
  ...(await orig<typeof import("@/lib/stay-days")>()),
  snapStayToShopHours: (_s: unknown, a: Date, b: Date) => ({ checkIn: a, checkOut: b }),
}));
vi.mock("@/services/CouponService", () => ({ couponService: { preview: vi.fn(), claim: vi.fn(), release: vi.fn() } }));
vi.mock("@/services/ReferralService", () => ({
  referralService: { check: vi.fn(), resolveDiscount: vi.fn().mockResolvedValue(null) },
}));
vi.mock("@/services/BookingService", () => ({
  bookingService: { findBookingByIdempotencyKey: vi.fn().mockResolvedValue(null), createInitialBooking: mocks.create },
}));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyBookingSuccess: vi.fn().mockResolvedValue(undefined),
    notifyPartnerAndAdminsForNewPaidBooking: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/services/AnalyticsService", () => ({ analyticsService: { track: vi.fn() } }));

import {
  OPERATING_SHOP_FILTER,
  PUBLIC_SHOP_FILTER,
  PUBLIC_SHOP_SQL_CONDITION,
  isShopBookableBy,
  shopVisibilityFilter,
  shopVisibilitySqlCondition,
} from "@/lib/public-shop-filter";
import { resolveMobileShopViewer, signAccessToken } from "@/lib/mobile-auth";
import { getActiveShopsOrderedByDistanceKm } from "@/lib/shop-distance-postgis";
import { GET as detailGET } from "@/app/api/mobile/shops/[id]/route";
import { GET as reviewsGET } from "@/app/api/mobile/shops/[id]/reviews/route";
import { GET as nearbyGET } from "@/app/api/mobile/shops/nearby/route";
import { POST as quotePOST } from "@/app/api/mobile/checkout/quote/route";
import { POST as intentPOST } from "@/app/api/mobile/checkout/intent/route";

type Who = "anon" | "real" | "test";
const tokens: Record<Exclude<Who, "anon"> | "expired", string> = { real: "", test: "", expired: "" };

beforeAll(async () => {
  process.env.MOBILE_JWT_SECRET = "unit-test-secret-not-real-0123456789";
  tokens.real = await signAccessToken("u-real", "GUEST", 0);
  tokens.test = await signAccessToken("u-test", "GUEST", 0);
  // Ayni iddialar, suresi gecmis: istemcinin 15 dk sonra elinde kalan token.
  tokens.expired = await new SignJWT({ role: "GUEST", type: "access", tv: 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.mobile)
    .setSubject("u-test")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(process.env.MOBILE_JWT_SECRET));
});
beforeEach(() => {
  mocks.rawSql.length = 0;
  mocks.create.mockReset();
  mocks.create.mockImplementation(async (d: { shopId: string; checkInTime: Date; checkOutTime: Date }) => ({
    id: "b1",
    status: "APPROVED",
    totalPrice: 100,
    checkInTime: d.checkInTime,
    checkOutTime: d.checkOutTime,
  }));
});

const headers = (who: Who): Record<string, string> =>
  who === "anon" ? {} : { authorization: `Bearer ${tokens[who]}` };
const get = (path: string, who: Who) => new NextRequest(`https://bagajpark.com/api/mobile${path}`, { headers: headers(who) });
const post = (path: string, who: Who, body: unknown) =>
  new NextRequest(`https://bagajpark.com/api/mobile${path}`, {
    method: "POST",
    headers: { ...headers(who), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const checkoutBody = (shopId: string) => ({
  shopId,
  checkInTime: "2026-11-24T10:00:00.000Z",
  checkOutTime: "2026-11-24T14:00:00.000Z",
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("kural: tek yardimci", () => {
  it("anonim ve gercek kullaniciya sabitin KENDISI doner", () => {
    for (const v of [null, undefined, {}, { reviewSandbox: false }, { reviewSandbox: null }, { isTest: true }]) {
      expect(shopVisibilityFilter(v)).toBe(PUBLIC_SHOP_FILTER);
      expect(shopVisibilitySqlCondition(v)).toBe(PUBLIC_SHOP_SQL_CONDITION);
    }
  });

  it("test izleyici: gercek kosul + aktif test dukkani", () => {
    expect(shopVisibilityFilter({ reviewSandbox: true })).toEqual({
      OR: [PUBLIC_SHOP_FILTER, { isActive: true, isTest: true }],
    });
    expect(shopVisibilitySqlCondition({ reviewSandbox: true })).toContain(PUBLIC_SHOP_SQL_CONDITION);
  });

  it("rezervasyon kapisi", () => {
    const s = (o: Partial<{ isActive: boolean; isTest: boolean; isPrelaunch: boolean }>) => ({
      isActive: true,
      isTest: false,
      isPrelaunch: false,
      ...o,
    });
    expect(isShopBookableBy(s({}), null)).toBe(true);
    expect(isShopBookableBy(s({ isTest: true }), null)).toBe(false);
    expect(isShopBookableBy(s({ isTest: true }), { reviewSandbox: false })).toBe(false);
    expect(isShopBookableBy(s({ isTest: true }), { reviewSandbox: true })).toBe(true);
    expect(isShopBookableBy(s({ isTest: true, isActive: false }), { reviewSandbox: true })).toBe(false);
    expect(isShopBookableBy(s({ isTest: true, isPrelaunch: true }), { reviewSandbox: true })).toBe(false);
    // OPERATING_SHOP_FILTER'in anonim karsiligi degismedi.
    expect(OPERATING_SHOP_FILTER).toEqual({ isActive: true, isTest: false, isPrelaunch: false });
  });
});

describe("resolveMobileShopViewer", () => {
  it("token yok: anonim, bayat degil", async () => {
    expect(await resolveMobileShopViewer(get("/x", "anon"))).toEqual({ viewer: null, stale: false });
  });

  it("bozuk ya da suresi dolmus token: anonim + stale (401 DEGIL)", async () => {
    const bad = new NextRequest("https://bagajpark.com/api/mobile/x", { headers: { authorization: "Bearer bozuk" } });
    expect(await resolveMobileShopViewer(bad)).toEqual({ viewer: null, stale: true });
    const expired = new NextRequest("https://bagajpark.com/api/mobile/x", { headers: { authorization: `Bearer ${tokens.expired}` } });
    expect(await resolveMobileShopViewer(expired)).toEqual({ viewer: null, stale: true });
  });

  it("bayrak `reviewSandbox`tan; `User.isTest` etiketi kum havuzu acmaz", async () => {
    expect(await resolveMobileShopViewer(get("/x", "real"))).toEqual({ viewer: { id: expect.any(String), reviewSandbox: false }, stale: false });
    expect(await resolveMobileShopViewer(get("/x", "test"))).toEqual({ viewer: { id: expect.any(String), reviewSandbox: true }, stale: false });
  });

  it("uclar bayat token'da `X-Auth-Stale: 1` koyar, gecerli/olmayan token'da koymaz", async () => {
    const stale = new NextRequest(`https://bagajpark.com/api/mobile/shops/${ids.sandbox}`, {
      headers: { authorization: `Bearer ${tokens.expired}` },
    });
    const res = await detailGET(stale, params(ids.sandbox));
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Auth-Stale")).toBe("1");
    expect((await detailGET(get(`/shops/${ids.sandbox}`, "test"), params(ids.sandbox))).headers.get("X-Auth-Stale")).toBeNull();
    expect((await nearbyGET(get("/shops/nearby?lat=41&lng=29", "anon"))).headers.get("X-Auth-Stale")).toBeNull();
  });
});

describe("mesafe sorgusu", () => {
  it("anonim: SQL ve yedek yol test dukkanini dislar", async () => {
    const rows = await getActiveShopsOrderedByDistanceKm({ centerLat: 41, centerLng: 29, radiusKm: 5 });
    expect(rows.map((r) => r.shop.id)).toEqual([ids.real]);
    expect(mocks.rawSql[0]).toContain(PUBLIC_SHOP_SQL_CONDITION);
    expect(mocks.rawSql[0]).not.toContain(`s."isTest" = true`);
  });

  it("test izleyici: test dukkani da gelir", async () => {
    const rows = await getActiveShopsOrderedByDistanceKm({ centerLat: 41, centerLng: 29, radiusKm: 5, viewer: { reviewSandbox: true } });
    // Prelaunch test noktasi ayni konumdaki gercek dukkanca gizlenir (`hideSupersededPrelaunch`, kural aynen).
    expect(rows.map((r) => r.shop.id).sort()).toEqual([ids.real, ids.sandbox].sort());
    expect(mocks.rawSql[0]).toContain(`s."isTest" = true`);
  });
});

describe("GET /shops/nearby (tarihsiz)", () => {
  const ids_ = async (who: Who) =>
    ((await (await nearbyGET(get("/shops/nearby?lat=41&lng=29", who))).json()) as { id: string }[]).map((s) => s.id);

  it.each<Who>(["anon", "real"])("%s: yalnizca gercek dukkan", async (who) => {
    expect(await ids_(who)).toEqual([ids.real]);
  });

  it("test: gercek dukkan + test dukkanlari", async () => {
    expect(await ids_("test")).toEqual(expect.arrayContaining([ids.real, ids.sandbox]));
  });
});

describe("GET /shops/:id ve /reviews", () => {
  it.each<Who>(["anon", "real"])("%s: test dukkani 404, gercek dukkan 200", async (who) => {
    expect((await detailGET(get(`/shops/${ids.sandbox}`, who), params(ids.sandbox))).status).toBe(404);
    expect((await reviewsGET(get(`/shops/${ids.sandbox}/reviews`, who), params(ids.sandbox))).status).toBe(404);
    expect((await detailGET(get(`/shops/${ids.real}`, who), params(ids.real))).status).toBe(200);
  });

  it("test: test dukkani da 200, gercek dukkan etkilenmez", async () => {
    expect((await detailGET(get(`/shops/${ids.sandbox}`, "test"), params(ids.sandbox))).status).toBe(200);
    expect((await detailGET(get(`/shops/${ids.real}`, "test"), params(ids.real))).status).toBe(200);
  });
});

describe("POST /checkout/quote ve /checkout/intent", () => {
  it("anonim: oturum zorunlu (401)", async () => {
    expect((await quotePOST(post("/checkout/quote", "anon", checkoutBody(ids.sandbox))))?.status).toBe(401);
    expect((await intentPOST(post("/checkout/intent", "anon", checkoutBody(ids.sandbox))))?.status).toBe(401);
  });

  it("gercek kullanici: test dukkani 404 ve rezervasyon YAZILMAZ", async () => {
    expect((await quotePOST(post("/checkout/quote", "real", checkoutBody(ids.sandbox))))?.status).toBe(404);
    const res = await intentPOST(post("/checkout/intent", "real", checkoutBody(ids.sandbox)));
    expect(res?.status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("test kullanici: test dukkanina quote + intent", async () => {
    expect((await quotePOST(post("/checkout/quote", "test", checkoutBody(ids.sandbox))))?.status).toBe(200);
    const res = await intentPOST(post("/checkout/intent", "test", checkoutBody(ids.sandbox)));
    expect(res?.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ shopId: ids.sandbox, guestId: "u-test" }));
  });

  it("test kullanici: prelaunch test dukkani yine 404", async () => {
    expect((await quotePOST(post("/checkout/quote", "test", checkoutBody(ids.prelaunchSandbox))))?.status).toBe(404);
  });

  it.each<Who>(["real", "test"])("%s: gercek dukkan etkilenmez", async (who) => {
    expect((await quotePOST(post("/checkout/quote", who, checkoutBody(ids.real))))?.status).toBe(200);
    expect((await intentPOST(post("/checkout/intent", who, checkoutBody(ids.real))))?.status).toBe(200);
  });
});
