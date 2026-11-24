import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Dukkan personeli yetki matrisi (2026-11-24): sahip / personel / baska esnaf / misafir,
 * gercek kapi (`src/lib/shop-access.ts`) ve gercek uclarla. Veritabani bellek ici:
 * tek dukkan `s1` (sahibi `owner`), personeli `staff`.
 */
const { db, mockRequireMobileUser, mockCheckIn, mockCancel, mockListTeam, mockInvite } = vi.hoisted(() => {
  const shops = [{ id: "s1", ownerId: "owner", name: "Otel", isActive: true, createdAt: new Date(0), timezone: "Europe/Istanbul" }];
  const members: { shopId: string; userId: string }[] = [];
  const db = {
    shops,
    members,
    shop: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => shops.find((s) => s.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }: { where: { ownerId?: string; id?: { in: string[] } } }) =>
        shops.filter((s) => (where.ownerId ? s.ownerId === where.ownerId : where.id ? where.id.in.includes(s.id) : true)),
      ),
    },
    shopMember: {
      findUnique: vi.fn(async ({ where }: { where: { shopId_userId: { shopId: string; userId: string } } }) => {
        const k = where.shopId_userId;
        return members.find((m) => m.shopId === k.shopId && m.userId === k.userId) ? { id: "m" } : null;
      }),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        members
          .filter((m) => m.userId === where.userId)
          .map((m) => ({ shop: shops.find((s) => s.id === m.shopId)! }))
          .filter((m) => m.shop.ownerId !== where.userId),
      ),
      count: vi.fn(async ({ where }: { where: { userId: string } }) => members.filter((m) => m.userId === where.userId).length),
    },
    booking: {
      findUnique: vi.fn(async () => ({
        id: "b1",
        status: "PAID",
        checkInTime: new Date(Date.now() + 3600_000),
        guestId: "guest",
        guestEmail: null,
        locale: "tr",
        guest: { email: null },
        shop: { id: "s1", ownerId: "owner" },
      })),
    },
  };
  return {
    db,
    mockRequireMobileUser: vi.fn(),
    mockCheckIn: vi.fn(),
    mockCancel: vi.fn(),
    mockListTeam: vi.fn(),
    mockInvite: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ default: db }));
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/services/BookingService", () => ({ bookingService: { checkIn: mockCheckIn } }));
vi.mock("@/services/booking/lifecycle", () => ({ cancelBooking: mockCancel }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: { notifyCheckIn: vi.fn().mockResolvedValue(undefined), pushGuestOnly: vi.fn() },
}));
vi.mock("@/services/ShopStaffService", async (orig) => ({
  ...(await orig<typeof import("@/services/ShopStaffService")>()),
  listTeam: mockListTeam,
  inviteStaff: mockInvite,
}));

import { POST as checkIn } from "@/app/api/mobile/bookings/[id]/check-in/route";
import { POST as partnerCancel } from "@/app/api/mobile/partner/bookings/[id]/cancel/route";
import { GET as teamGet, POST as teamInvite } from "@/app/api/mobile/partner/team/route";
import { GET as earnings } from "@/app/api/mobile/partner/earnings/stats/route";
import { assertShopAccess, relationAllows } from "@/lib/shop-access";
import { requireShopAccess } from "@/lib/action-auth";

const ACTORS = {
  owner: { id: "owner", role: "PARTNER" },
  staff: { id: "staff", role: "GUEST" },
  otherPartner: { id: "other", role: "PARTNER" },
  guest: { id: "guest", role: "GUEST" },
} as const;
type Who = keyof typeof ACTORS;

function as(who: Who) {
  mockRequireMobileUser.mockResolvedValue({ user: ACTORS[who] });
}
const params = { params: Promise.resolve({ id: "b1" }) };
const post = (url: string, body: unknown = {}) =>
  new NextRequest(`https://bagajpark.com/api/mobile${url}`, { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  db.members.splice(0, db.members.length, { shopId: "s1", userId: "staff" });
  mockCheckIn.mockResolvedValue({ ok: true });
  mockCancel.mockResolvedValue({ ok: true });
  mockListTeam.mockResolvedValue({ members: [], invites: [], limit: 10 });
  mockInvite.mockResolvedValue({ ok: true, kind: "invited" });
});

describe("seviye kurali", () => {
  it("operate: sahip/personel/yonetici; manage: personel haric", () => {
    expect(relationAllows("staff", "operate")).toBe(true);
    expect(relationAllows("staff", "manage")).toBe(false);
    expect(relationAllows("owner", "manage")).toBe(true);
    expect(relationAllows("admin", "manage")).toBe(true);
    expect(relationAllows(null, "operate")).toBe(false);
  });

  it("assertShopAccess: yok ile yetkisiz ayri", async () => {
    expect(await assertShopAccess(ACTORS.staff, "yok", "operate")).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await assertShopAccess(ACTORS.guest, "s1", "operate")).toEqual({ ok: false, code: "FORBIDDEN" });
    expect((await assertShopAccess({ id: "a", role: "ADMIN" }, "s1", "manage")).ok).toBe(true);
  });
});

describe("mobil uclar: yetki matrisi", () => {
  const checkInStatus: Record<Who, number> = { owner: 200, staff: 200, otherPartner: 403, guest: 403 };
  it.each(Object.keys(checkInStatus) as Who[])("check-in (operate): %s", async (who) => {
    as(who);
    const res = (await checkIn(post("/bookings/b1/check-in"), params))!;
    expect(res.status).toBe(checkInStatus[who]);
    expect(mockCheckIn).toHaveBeenCalledTimes(checkInStatus[who] === 200 ? 1 : 0);
  });

  const cancelStatus: Record<Who, number> = { owner: 200, staff: 403, otherPartner: 403, guest: 403 };
  it.each(Object.keys(cancelStatus) as Who[])("esnaf iptali (manage): %s", async (who) => {
    as(who);
    const res = (await partnerCancel(post("/partner/bookings/b1/cancel", { reason: "guest_request" }), params))!;
    expect(res.status).toBe(cancelStatus[who]);
  });

  const teamStatus: Record<Who, number> = { owner: 200, staff: 403, otherPartner: 403, guest: 403 };
  it.each(Object.keys(teamStatus) as Who[])("ekip listesi ve davet (manage): %s", async (who) => {
    as(who);
    const get = (await teamGet(new NextRequest("https://bagajpark.com/api/mobile/partner/team?shop=s1")))!;
    expect(get.status).toBe(teamStatus[who]);
    const inv = (await teamInvite(post("/partner/team?shop=s1", { email: "yeni@example.com" })))!;
    expect(inv.status).toBe(teamStatus[who]);
    expect(mockInvite).toHaveBeenCalledTimes(teamStatus[who] === 200 ? 1 : 0);
  });

  it("kazanc: personel ve baska esnaf dukkan goremez", async () => {
    for (const who of ["staff", "otherPartner"] as const) {
      as(who);
      const res = (await earnings(new NextRequest("https://bagajpark.com/api/mobile/partner/earnings/stats?shop=s1")))!;
      expect([403, 404]).toContain(res.status);
    }
  });

  it("personel cikarilinca bir sonraki istek reddedilir (onbellek yok)", async () => {
    as("staff");
    expect((await checkIn(post("/bookings/b1/check-in"), params))!.status).toBe(200);
    db.members.splice(0, db.members.length);
    expect((await checkIn(post("/bookings/b1/check-in"), params))!.status).toBe(403);
  });

  it("yonetici goruntulemesinde ekip yazimi kapali", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ACTORS.owner, impersonatedBy: "admin-1" } });
    const inv = (await teamInvite(post("/partner/team?shop=s1", { email: "yeni@example.com" })))!;
    expect(inv.status).toBe(403);
    expect(mockInvite).not.toHaveBeenCalled();
  });
});

describe("web action kapisi: requireShopAccess", () => {
  const cases: [Who, "operate" | "manage", boolean][] = [
    ["owner", "manage", true],
    ["owner", "operate", true],
    ["staff", "operate", true],
    ["staff", "manage", false],
    ["otherPartner", "operate", false],
    ["guest", "operate", false],
  ];
  it.each(cases)("%s / %s -> %s", async (who, level, ok) => {
    mockAuth.mockResolvedValue({ user: ACTORS[who] });
    const res = await requireShopAccess("s1", level);
    expect(res.ok).toBe(ok);
    if (!res.ok) expect(res.error).toBe("Errors.unauthorized");
  });

  it("oturumsuz: giris iste", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await requireShopAccess("s1", "operate")).toEqual({ ok: false, error: "Errors.authRequired" });
  });
});
