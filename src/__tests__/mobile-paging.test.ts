import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Imlecli sayfalama: esnafin Gecmis sekmesi (100'de kesiliyordu), yonetici
 * rezervasyon/kullanici/mesaj listeleri (50/50/100) ve dukkan yorumlari (50).
 * Eski uygulama (0.3.0-0.3.3) parametre gondermez: yanit bicimi degismemeli.
 */
const db = vi.hoisted(() => ({
  shop: { findMany: vi.fn() },
  booking: { findMany: vi.fn(), count: vi.fn() },
  user: { findMany: vi.fn() },
  contactMessage: { findMany: vi.fn() },
  review: { findMany: vi.fn(), count: vi.fn() },
}));
const role = vi.hoisted(() => ({ current: "PARTNER" }));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(async () => ({ user: { id: "u1", role: role.current } })),
  requireRole: vi.fn((u: { role: string }, roles: string[]) =>
    roles.includes(u.role) ? null : new Response(null, { status: 403 }),
  ),
}));
vi.mock("@/services/ShopService", () => ({
  ShopService: class {
    getPublicShopById = vi.fn(async () => ({ id: "s1" }));
  },
}));

import { cursorArgs, parseCursor, parseLimit, toPage } from "@/lib/cursor-page";

const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `id${from + i}` }));
const req = (path: string) => new NextRequest(`https://bagajpark.com/api/mobile${path}`);
const json = (res: Response | undefined) => {
  if (!res) throw new Error("yanit yok");
  return res.json();
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of Object.values(db)) for (const f of Object.values(m)) f.mockResolvedValue([]);
  db.booking.count.mockResolvedValue(0);
  db.review.count.mockResolvedValue(0);
});

describe("cursor-page", () => {
  it("bir fazla satir isteyip sonraki imleci son gosterilen satirdan verir", () => {
    expect(cursorArgs(null, 50)).toEqual({ take: 51 });
    expect(cursorArgs("abc", 50)).toEqual({ take: 51, cursor: { id: "abc" }, skip: 1 });
    expect(toPage(ids(51), 50)).toEqual({ items: ids(50), nextCursor: "id49" });
    expect(toPage(ids(50), 50)).toEqual({ items: ids(50), nextCursor: null });
  });

  it("imlec yalnizca id bicimi; limit sinirli", () => {
    expect(parseCursor("9f2c1e0a-1b2c-4d5e-8f90-123456789abc")).toBe("9f2c1e0a-1b2c-4d5e-8f90-123456789abc");
    expect(parseCursor("x' OR 1=1")).toBeNull();
    expect(parseCursor(null)).toBeNull();
    expect(parseLimit("500", 20, 50)).toBe(50);
    expect(parseLimit("abc", 20, 50)).toBe(20);
  });
});

describe("GET /partner/bookings", () => {
  beforeEach(() => {
    role.current = "PARTNER";
    db.shop.findMany.mockResolvedValue([{ id: "s1", name: "Dukkan" }]);
  });
  const row = (id: string) => ({
    id,
    shopId: "s1",
    checkInTime: new Date("2026-11-01T09:00:00Z"),
    checkOutTime: new Date("2026-11-01T18:00:00Z"),
    bagCountS: 1,
    bagCountM: 0,
    bagCountXl: 0,
    totalPrice: 100,
    status: "CHECKED_OUT",
    guest: { name: "Misafir" },
  });

  it("ilk sayfa: aktifler + gecmisin ilk sayfasi, daha eskisi varsa nextCursor", async () => {
    db.booking.findMany
      .mockResolvedValueOnce([]) // aktifler
      .mockResolvedValueOnce(["h1", "h2", "h3"].map(row));
    const { GET } = await import("@/app/api/mobile/partner/bookings/route");
    const body = await json(await GET(req("/partner/bookings?limit=2")));
    expect(body.items.map((b: { id: string }) => b.id)).toEqual(["h1", "h2"]);
    expect(body.nextCursor).toBe("h2");
    expect(body).toMatchObject({ page: 1, limit: 2 });
    const historyCall = db.booking.findMany.mock.calls[1][0];
    expect(historyCall.take).toBe(3);
    expect(historyCall.orderBy).toEqual([{ checkOutTime: "desc" }, { id: "desc" }]);
  });

  it("imlecle: yalnizca gecmis, aktifler tekrar gelmez", async () => {
    db.booking.findMany.mockResolvedValueOnce(["h3"].map(row));
    const { GET } = await import("@/app/api/mobile/partner/bookings/route");
    const body = await json(await GET(req("/partner/bookings?limit=2&cursor=h2")));
    expect(db.booking.findMany).toHaveBeenCalledTimes(1);
    expect(db.booking.findMany.mock.calls[0][0]).toMatchObject({ cursor: { id: "h2" }, skip: 1, take: 3 });
    expect(body.items.map((b: { id: string }) => b.id)).toEqual(["h3"]);
    expect(body.nextCursor).toBeNull();
  });

  it("eski istemci ?page=2: ofset yolu calismaya devam eder", async () => {
    const { GET } = await import("@/app/api/mobile/partner/bookings/route");
    await GET(req("/partner/bookings?limit=100&page=2"));
    expect(db.booking.findMany).toHaveBeenCalledTimes(1);
    expect(db.booking.findMany.mock.calls[0][0]).toMatchObject({ skip: 100, take: 101 });
  });
});

describe("yonetici listeleri", () => {
  beforeEach(() => {
    role.current = "ADMIN";
  });

  it("rezervasyonlar: 50'den fazlasi varsa nextCursor, imlec sorguya gecer", async () => {
    db.booking.findMany.mockResolvedValue(
      ids(51).map((r) => ({
        ...r,
        shopId: "s1",
        status: "CHECKED_IN",
        checkInTime: new Date(),
        checkOutTime: new Date(),
        bagCountS: 1,
        bagCountM: 0,
        bagCountXl: 0,
        totalPrice: 1,
        createdAt: new Date(),
        guestEmail: null,
        shop: { name: "D" },
        guest: { name: "G", email: "g@x" },
      })),
    );
    const { GET } = await import("@/app/api/mobile/admin/bookings/route");
    const body = await json(await GET(req("/admin/bookings?filter=overdue&cursor=id0")));
    expect(body.bookings).toHaveLength(50);
    expect(body.nextCursor).toBe("id49");
    const call = db.booking.findMany.mock.calls[0][0];
    expect(call).toMatchObject({ cursor: { id: "id0" }, skip: 1, take: 51 });
    expect(call.orderBy).toEqual([{ checkOutTime: "asc" }, { id: "asc" }]);
  });

  it("kullanicilar: bos aramada da sayfalanir", async () => {
    db.user.findMany.mockResolvedValue(
      ids(51).map((r) => ({ ...r, name: "A", email: "a@x", phone: null, role: "GUEST", isBanned: false, isTest: false, createdAt: new Date(), _count: { bookings: 0, shops: 0 } })),
    );
    const { GET } = await import("@/app/api/mobile/admin/users/route");
    const body = await json(await GET(req("/admin/users")));
    expect(body.users).toHaveLength(50);
    expect(body.nextCursor).toBe("id49");
  });

  it("mesajlar: parametresiz istek eskisi gibi dizi, ?paged=1 sayfali nesne", async () => {
    const msg = (id: string) => ({ id, from: "a@x", subject: "s", text: "t", html: null, isRead: false, category: null, createdAt: new Date(), replies: [] });
    db.contactMessage.findMany.mockResolvedValue(["m1", "m2"].map(msg));
    const { GET } = await import("@/app/api/mobile/admin/messages/route");
    const legacy = await json(await GET(req("/admin/messages")));
    expect(Array.isArray(legacy)).toBe(true);
    expect(db.contactMessage.findMany.mock.calls[0][0].take).toBe(100);

    db.contactMessage.findMany.mockResolvedValue(ids(31).map((r) => msg(r.id)));
    const paged = await json(await GET(req("/admin/messages?paged=1&cursor=m0")));
    expect(paged.messages).toHaveLength(30);
    expect(paged.nextCursor).toBe("id29");
    expect(db.contactMessage.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: "m0" }, skip: 1, take: 31 });
  });
});

describe("GET /shops/:id/reviews", () => {
  const review = (id: string) => ({ id, rating: 5, comment: null, createdAt: new Date("2026-01-01Z"), guest: { name: "Ada L" } });
  const call = async (path: string) => {
    const { GET } = await import("@/app/api/mobile/shops/[id]/reviews/route");
    return (await GET(new Request(`https://bagajpark.com/api/mobile/shops/s1/reviews${path}`), { params: Promise.resolve({ id: "s1" }) })).json();
  };

  it("parametresiz: eski dizi bicimi", async () => {
    db.review.findMany.mockResolvedValue([review("r1")]);
    expect(Array.isArray(await call(""))).toBe(true);
  });

  it("?paged=1: gercek toplam ve imlec", async () => {
    db.review.findMany.mockResolvedValue(["r1", "r2", "r3"].map(review));
    db.review.count.mockResolvedValue(120);
    const body = await call("?paged=1&limit=2");
    expect(body.total).toBe(120);
    expect(body.items.map((r: { id: string }) => r.id)).toEqual(["r1", "r2"]);
    expect(body.items[0].authorLabel).toBe("Ada");
    expect(body.nextCursor).toBe("r2");
  });
});
