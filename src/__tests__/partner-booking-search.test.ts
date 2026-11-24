import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * `GET /partner/bookings?q=` (kural 3). Eslesme SQL'i gercek DB'de
 * `partner-booking-search.integration.test.ts`te; burasi kapsam, q kurallari
 * ve sayfalama biciminin DEGISMEDIGINI olcer.
 */
const db = vi.hoisted(() => ({
  shop: { findMany: vi.fn() },
  shopMember: { findMany: vi.fn().mockResolvedValue([]) },
  booking: { findMany: vi.fn(), count: vi.fn() },
  bookingEvent: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(async () => ({ user: { id: "partner-a", role: "PARTNER" } })),
  requireRole: vi.fn(() => null),
}));
vi.mock("@/services/booking/cancel-reason", () => ({ withCancelReasons: vi.fn(async (rows: unknown[]) => rows) }));

const { GET } = await import("@/app/api/mobile/partner/bookings/route");
const { normalizePartnerSearchQuery, bookingCodePrefix, phoneDigitsTail, partnerBookingSearchWhere } = await import(
  "@/services/PartnerBookingSearchService"
);

const req = (qs: string) => new NextRequest(`https://bagajpark.com/api/mobile/partner/bookings${qs}`);
const row = (id: string, status = "CHECKED_OUT") => ({
  id,
  shopId: "s1",
  checkInTime: new Date("2026-11-01T09:00:00Z"),
  checkOutTime: new Date("2026-11-01T18:00:00Z"),
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  totalPrice: 100,
  status,
  guest: { name: "Misafir" },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.shop.findMany.mockResolvedValue([
    { id: "s1", name: "A1" },
    { id: "s2", name: "A2" },
  ]);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.count.mockResolvedValue(0);
  db.$queryRaw.mockResolvedValue([]);
});

describe("q kurallari", () => {
  it("kirpilir; bos ya da 2 karakterden kisa q yok sayilir", () => {
    expect(normalizePartnerSearchQuery(undefined)).toBeNull();
    expect(normalizePartnerSearchQuery("   ")).toBeNull();
    expect(normalizePartnerSearchQuery(" a ")).toBeNull();
    expect(normalizePartnerSearchQuery("  ab ")).toBe("ab");
  });

  it("kod on eki yalnizca onaltilik; EMN- ve tire dusurulur", () => {
    expect(bookingCodePrefix("D8A7-FF57")).toBe("d8a7ff57");
    expect(bookingCodePrefix("EMN-D8A7FF")).toBe("d8a7ff");
    expect(bookingCodePrefix("Ayşe")).toBeNull();
  });

  it("telefon kuyrugu en az 4 rakam ve yalnizca telefon karakterleri", () => {
    expect(phoneDigitsTail("123")).toBeNull();
    expect(phoneDigitsTail("+90 (555) 1234")).toBe("905551234");
    expect(phoneDigitsTail("Ali 1234")).toBeNull();
  });

  it("q yoksa filtre eklenmez ve SQL calismaz", async () => {
    expect(await partnerBookingSearchWhere(["s1"], "a")).toEqual({ where: {}, match: null });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("dukkansiz esnafta SQL calismaz, sonuc bos", async () => {
    expect(await partnerBookingSearchWhere([], "ilker")).toEqual({
      where: { id: { in: [] } },
      match: { ids: [], total: 0, truncated: false },
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("GET /partner/bookings?q=", () => {
  it("q bos: bugunku sorgu aynen (kimlik filtresi yok)", async () => {
    await GET(req("?q=%20"));
    expect(db.$queryRaw).not.toHaveBeenCalled();
    const where = db.booking.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("id");
    expect(where.shopId).toEqual({ in: ["s1", "s2"] });
  });

  it("arama esnafin dukkanlariyla sinirli; eslesen kimlikler uc sorguya da girer", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "b1", total: BigInt(1) }]);
    await GET(req("?q=ilker"));
    // Kapsam: sorguya giden dukkan listesi yalnizca esnafin kendi dukkanlari.
    expect(db.shop.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "partner-a" } }));
    expect(db.shopMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "partner-a" }) }));
    const sqlValues = db.$queryRaw.mock.calls[0].slice(1);
    expect(sqlValues[0]).toEqual(["s1", "s2"]);
    for (const call of db.booking.findMany.mock.calls) {
      expect(call[0].where).toMatchObject({ shopId: { in: ["s1", "s2"] }, id: { in: ["b1"] } });
    }
    expect(db.booking.count.mock.calls[0][0].where).toMatchObject({ id: { in: ["b1"] } });
  });

  it("shopId baska esnafinsa hicbir sey donmez", async () => {
    await GET(req("?q=ilker&shopId=foreign-shop"));
    expect(db.$queryRaw).not.toHaveBeenCalled();
    for (const call of db.booking.findMany.mock.calls) {
      expect(call[0].where.shopId).toEqual({ in: [] });
    }
  });

  it("shopId kendi dukkaniysa ona daraltir", async () => {
    await GET(req("?q=ilker&shopId=s2"));
    expect(db.$queryRaw.mock.calls[0].slice(1)[0]).toEqual(["s2"]);
  });

  it("sayfalama bicimi ve imlec semantigi degismez", async () => {
    db.$queryRaw.mockResolvedValue([
      { id: "id0", total: 3 },
      { id: "id1", total: 3 },
      { id: "id2", total: 3 },
    ]);
    db.booking.findMany.mockImplementation(async (args: { where: { status?: unknown } }) =>
      args.where.status ? [row("id0"), row("id1"), row("id2")] : [],
    );
    db.booking.count.mockResolvedValue(3);
    const res = await GET(req("?q=ilker&limit=2&cursor=9f2c1e0a-1b2c-4d5e-8f90-123456789abc"));
    const body = await res!.json();
    // Bugunku alanlar aynen; aramada yalnizca `searchTruncated` eklenir.
    expect(Object.keys(body).sort()).toEqual(["items", "limit", "nextCursor", "page", "searchTruncated", "total"]);
    expect(body.searchTruncated).toBe(false);
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["id0", "id1"]);
    expect(body.nextCursor).toBe("id1");
    const history = db.booking.findMany.mock.calls.find((c) => c[0].where.status)![0];
    expect(history).toMatchObject({ take: 3, cursor: { id: "9f2c1e0a-1b2c-4d5e-8f90-123456789abc" }, skip: 1 });
  });
});

describe("tavan ve toplam", () => {
  it("SQL deterministik sirayla keser; toplam tavandan bagimsiz, kesilme isaretlenir", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "b1", total: BigInt(1500) }]);
    const res = await GET(req("?q=ilker"));
    const body = await res!.json();
    expect(body.total).toBe(1500);
    expect(body.searchTruncated).toBe(true);
    const sql = (db.$queryRaw.mock.calls[0][0] as string[]).join("?");
    expect(sql).toMatch(/ORDER BY b\."checkOutTime" DESC, b\."id" DESC\s+LIMIT/);
    expect(sql).toMatch(/COUNT\(\*\) OVER\(\)/);
  });

  it("q yokken yanitta searchTruncated alani YOK (bugunku bicim)", async () => {
    const body = await (await GET(req("")))!.json();
    expect(body).not.toHaveProperty("searchTruncated");
  });
});

describe("web esnaf listesi ayni servisi kullanir", () => {
  it("sayfa partnerBookingSearchWhere'i kendi dukkan kimlikleriyle cagirir", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/[locale]/partner/bookings/page.tsx"), "utf8");
    // Kapsam sahip + personel olunan dukkanlar (`operableShopIds`), mobil uc ile ayni.
    expect(src).toMatch(/partnerBookingSearchWhere\(q \? shopIds : \[\], q\)/);
    expect(src).toMatch(/partnerBookingsSearchTruncated/);
    expect(src).toMatch(/operableShopIds\(userId\)/);
  });
});
