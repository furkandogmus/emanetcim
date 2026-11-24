import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * D1 mobil admin uclari: ADMIN olmayana 403, goruntuleme oturumunda yazan uclar
 * kapali, govde dogrulamasi, servis hata kodlarinin HTTP karsiligi ve suzgec
 * parametrelerinin servise dogru gecisi. Kurallar `admin-parity-d1-services.test.ts`te.
 */

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
const svc = vi.hoisted(() => ({
  searchPage: vi.fn(),
  deleteUser: vi.fn(),
  blockUserIp: vi.fn(),
  getDetail: vi.fn(),
  setBanned: vi.fn(),
  setReviewSandbox: vi.fn(),
}));
vi.mock("@/services/AdminUserService", () => ({ adminUserService: svc }));
const create = vi.hoisted(() => ({ convertGuest: vi.fn() }));
vi.mock("@/services/AdminPartnerCreateService", () => ({ adminPartnerCreateService: create }));
const inbox = vi.hoisted(() => ({ listPage: vi.fn(), listRecent: vi.fn(), counts: vi.fn(), removeMany: vi.fn() }));
vi.mock("@/services/AdminInboxService", () => ({
  adminInboxService: inbox,
  INBOX_BULK_MAX: 100,
  INBOX_CATEGORIES: ["SUPPORT", "BULK", "AUTOMATED"],
}));
const leads = vi.hoisted(() => ({ setContacted: vi.fn() }));
vi.mock("@/services/PartnerLeadService", () => ({ partnerLeadService: leads }));
const ops = vi.hoisted(() => ({ bookingNotifications: vi.fn() }));
vi.mock("@/services/AdminOpsService", () => ({ adminOpsService: ops }));
const aff = vi.hoisted(() => ({ unpaidCommissionsCsv: vi.fn() }));
vi.mock("@/services/AffiliateService", () => aff);

import { signAccessToken, signImpersonationToken } from "@/lib/mobile-auth";
import * as usersRoute from "@/app/api/mobile/admin/users/route";
import * as userRoute from "@/app/api/mobile/admin/users/[id]/route";
import * as blockIpRoute from "@/app/api/mobile/admin/users/[id]/block-ip/route";
import * as convertRoute from "@/app/api/mobile/admin/users/[id]/convert-partner/route";
import * as messagesRoute from "@/app/api/mobile/admin/messages/route";
import * as leadRoute from "@/app/api/mobile/admin/partner-leads/[id]/route";
import * as notificationsRoute from "@/app/api/mobile/admin/bookings/[id]/notifications/route";
import * as commissionsRoute from "@/app/api/mobile/admin/affiliates/commissions/route";

type IdParams = { params: Promise<{ id: string }> };
const must =
  <A extends unknown[]>(f: (...a: A) => Promise<Response | undefined>) =>
  async (...a: A): Promise<Response> => {
    const r = await f(...a);
    if (!r) throw new Error("yanit yok");
    return r;
  };
const listUsers = must((r: NextRequest) => usersRoute.GET(r));
const deleteUser = must((r: NextRequest, p: IdParams) => userRoute.DELETE(r, p));
const blockIp = must((r: NextRequest, p: IdParams) => blockIpRoute.POST(r, p));
const convert = must((r: NextRequest, p: IdParams) => convertRoute.POST(r, p));
const listMessages = must((r: NextRequest) => messagesRoute.GET(r));
const bulkDelete = must((r: NextRequest) => messagesRoute.DELETE(r));
const patchLead = must((r: NextRequest, p: IdParams) => leadRoute.PATCH(r, p));
const notifications = must((r: NextRequest, p: IdParams) => notificationsRoute.GET(r, p));
const commissions = must((r: NextRequest) => commissionsRoute.GET(r));

type Role = "ADMIN" | "PARTNER" | "GUEST";
const users: Record<string, { id: string; role: Role; isBanned: boolean; tokenVersion: number }> = {};
const seed = (id: string, role: Role) => (users[id] = { id, role, isBanned: false, tokenVersion: 0 });

function req(method: string, path: string, token: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

type Handler = (r: NextRequest, p: ReturnType<typeof params>) => Promise<Response>;
const MUTATING: [string, Handler, string, unknown][] = [
  ["kalici silme", deleteUser, "DELETE", { reason: "sahte hesap" }],
  ["IP engeli", blockIp, "POST", { reason: "spam" }],
  ["esnafa cevirme", convert, "POST", { phone: "05551112233" }],
  ["on kayit iletisim", patchLead, "PATCH", { contacted: true }],
  ["toplu mesaj silme", (r) => bulkDelete(r), "DELETE", { ids: ["m1"] }],
];

let adminToken: string;

beforeAll(() => {
  process.env.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
  delete process.env.MOBILE_JWT_SECRET;
});

beforeEach(async () => {
  for (const k of Object.keys(users)) delete users[k];
  seed("admin-1", "ADMIN");
  seed("guest-1", "GUEST");
  seed("partner-1", "PARTNER");
  db.user.findUnique.mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => users[where.id] ?? null);
  for (const f of [...Object.values(svc), create.convertGuest, ...Object.values(inbox), leads.setContacted, ops.bookingNotifications]) f.mockReset();
  svc.searchPage.mockResolvedValue({ items: [], nextCursor: null });
  inbox.listPage.mockResolvedValue({ items: [], nextCursor: null });
  inbox.counts.mockResolvedValue({ SUPPORT: 1, BULK: 2, AUTOMATED: 3, unread: 1 });
  adminToken = await signAccessToken("admin-1", "ADMIN", 0);
});

describe("yetki kapilari", () => {
  it.each(MUTATING)("%s: ADMIN olmayana 403", async (_l, handler, method, body) => {
    const token = await signAccessToken("partner-1", "PARTNER", 0);
    const res = await handler(req(method, "/x", token, body), params("u1"));
    expect(res.status).toBe(403);
  });

  it.each(MUTATING)("%s: goruntuleme oturumunda kapali", async (_l, handler, method, body) => {
    const { token } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    const res = await handler(req(method, "/x", token, body), params("u1"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_allowed_while_impersonating");
  });

  it("okuma uclari da ADMIN ister", async () => {
    const token = await signAccessToken("guest-1", "GUEST", 0);
    expect((await notifications(req("GET", "/x", token), params("b1"))).status).toBe(403);
    expect((await commissions(req("GET", "/x", token))).status).toBe(403);
    expect((await listMessages(req("GET", "/x?paged=1", token))).status).toBe(403);
    expect(ops.bookingNotifications).not.toHaveBeenCalled();
    expect(aff.unpaidCommissionsCsv).not.toHaveBeenCalled();
  });
});

describe("kullanici uclari", () => {
  it("liste suzgecleri servise gider, bilinmeyen deger yok sayilir", async () => {
    await listUsers(req("GET", "/api/mobile/admin/users?q=ada&role=PARTNER&status=BANNED&type=TEST", adminToken));
    expect(svc.searchPage).toHaveBeenLastCalledWith("ada", {
      cursor: null,
      filters: { role: "PARTNER", status: "BANNED", type: "TEST" },
    });
    await listUsers(req("GET", "/api/mobile/admin/users?role=ROOT&status=x", adminToken));
    expect(svc.searchPage).toHaveBeenLastCalledWith("", { cursor: null, filters: { role: null, status: null, type: null } });
  });

  it("silme gerekce ister; servis kodu 409 olur", async () => {
    expect((await deleteUser(req("DELETE", "/x", adminToken, {}), params("u1"))).status).toBe(400);
    expect((await deleteUser(req("DELETE", "/x", adminToken, { reason: "ab" }), params("u1"))).status).toBe(400);
    expect(svc.deleteUser).not.toHaveBeenCalled();

    svc.deleteUser.mockResolvedValue({ ok: false, error: "has_active_booking" });
    const res = await deleteUser(req("DELETE", "/x", adminToken, { reason: "sahte hesap" }), params("u1"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("has_active_booking");
    expect(svc.deleteUser).toHaveBeenCalledWith("u1", expect.objectContaining({ userId: "admin-1", reason: "sahte hesap" }));
  });

  it("IP engeli govdede IP almaz (strict) ve servis kodunu tasir", async () => {
    expect((await blockIp(req("POST", "/x", adminToken, { reason: "spam", ip: "1.2.3.4" }), params("u1"))).status).toBe(400);
    svc.blockUserIp.mockResolvedValue({ ok: false, error: "no_ip" });
    expect((await blockIp(req("POST", "/x", adminToken, { reason: "spam" }), params("u1"))).status).toBe(409);
    svc.blockUserIp.mockResolvedValue({ ok: true, ip: "198.51.100.7" });
    const res = await blockIp(req("POST", "/x", adminToken, { reason: "spam" }), params("u1"));
    expect(await res.json()).toEqual({ ok: true, ip: "198.51.100.7" });
  });

  it("esnafa cevirme web ile ayni govdeye gider; hedef yoldan, govdedeki userId yok sayilir", async () => {
    create.convertGuest.mockResolvedValue({ ok: false, reason: "phone_already_registered" });
    expect((await convert(req("POST", "/x", adminToken, {}), params("u1"))).status).toBe(409);
    create.convertGuest.mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await convert(req("POST", "/x", adminToken, {}), params("u1"))).status).toBe(404);
    create.convertGuest.mockResolvedValue({ ok: true, userId: "u1", shopId: "s1", phone: "5551112233", resetUrl: null });
    const res = await convert(req("POST", "/x", adminToken, { phone: "1", userId: "baska" }), params("u1"));
    expect(await res.json()).toEqual({ ok: true, shopId: "s1", phone: "5551112233", resetUrl: null });
    expect(create.convertGuest).toHaveBeenLastCalledWith(
      { id: "admin-1", role: "ADMIN" },
      { phone: "1", userId: "u1" },
      expect.objectContaining({ ip: expect.anything() }),
    );
  });
});

describe("gelen kutusu ucu", () => {
  it("parametresiz istek eski dizi bicimi (0.3.0-0.3.3)", async () => {
    inbox.listRecent.mockResolvedValue([]);
    const res = await listMessages(req("GET", "/api/mobile/admin/messages", adminToken));
    expect(await res.json()).toEqual([]);
    expect(inbox.listPage).not.toHaveBeenCalled();
  });

  it("suzgecler servise gider; sayilar yalniz ilk sayfada", async () => {
    const first = await listMessages(req("GET", "/api/mobile/admin/messages?paged=1&unread=1&category=BULK&q=iade", adminToken));
    expect(inbox.listPage).toHaveBeenLastCalledWith({ unreadOnly: true, category: "BULK", q: "iade" }, { cursor: null, take: 30 });
    expect((await first.json()).counts).toEqual({ SUPPORT: 1, BULK: 2, AUTOMATED: 3, unread: 1 });

    const next = await listMessages(req("GET", "/api/mobile/admin/messages?paged=1&category=NOPE&cursor=c1", adminToken));
    expect(inbox.listPage).toHaveBeenLastCalledWith({ unreadOnly: false, category: null, q: "" }, { cursor: "c1", take: 30 });
    expect((await next.json()).counts).toBeUndefined();
    expect(inbox.counts).toHaveBeenCalledTimes(1);
  });

  it("toplu silme: bos ve 100'den fazla kimlik 400", async () => {
    expect((await bulkDelete(req("DELETE", "/x", adminToken, { ids: [] }))).status).toBe(400);
    const many = Array.from({ length: 101 }, (_, i) => `m${i}`);
    expect((await bulkDelete(req("DELETE", "/x", adminToken, { ids: many }))).status).toBe(400);
    inbox.removeMany.mockResolvedValue(2);
    const res = await bulkDelete(req("DELETE", "/x", adminToken, { ids: ["m1", "m2"] }));
    expect(await res.json()).toEqual({ ok: true, deleted: 2 });
  });
});

describe("diger D1 uclari", () => {
  it("on kayit: degismezse 404, degisirse ok", async () => {
    expect((await patchLead(req("PATCH", "/x", adminToken, { contacted: "evet" }), params("l1"))).status).toBe(400);
    leads.setContacted.mockResolvedValue(false);
    expect((await patchLead(req("PATCH", "/x", adminToken, { contacted: true }), params("l1"))).status).toBe(404);
    leads.setContacted.mockResolvedValue(true);
    expect((await patchLead(req("PATCH", "/x", adminToken, { contacted: false }), params("l1"))).status).toBe(200);
    expect(leads.setContacted).toHaveBeenLastCalledWith("l1", false, expect.objectContaining({ userId: "admin-1" }));
  });

  it("bildirim kaydi: rezervasyon yoksa 404, varsa satirlar ISO tarihle", async () => {
    ops.bookingNotifications.mockResolvedValueOnce(null);
    expect((await notifications(req("GET", "/x", adminToken), params("b1"))).status).toBe(404);
    ops.bookingNotifications.mockResolvedValueOnce([
      { id: "n1", type: "EMAIL", recipient: "guest@example.test", status: "FAILED", error: "x".repeat(400), createdAt: new Date("2026-11-20T10:00:00Z") },
    ]);
    const body = await (await notifications(req("GET", "/x", adminToken), params("b1"))).json();
    expect(body.notifications[0]).toEqual(
      expect.objectContaining({ id: "n1", status: "FAILED", createdAt: "2026-11-20T10:00:00.000Z" }),
    );
    expect(body.notifications[0].error.length).toBeLessThanOrEqual(301);
  });

  it("komisyon CSV'si: ay bicimi dogrulanir, metin JSON'da doner", async () => {
    expect((await commissions(req("GET", "/x?month=2026-1", adminToken))).status).toBe(400);
    aff.unpaidCommissionsCsv.mockResolvedValue("a,b\n1,2");
    const res = await commissions(req("GET", "/x?month=2026-11", adminToken));
    expect(await res.json()).toEqual({ csv: "a,b\n1,2", filename: "araci-komisyon-2026-11.csv" });
    expect(aff.unpaidCommissionsCsv).toHaveBeenCalledWith({ month: "2026-11" });
  });
});
