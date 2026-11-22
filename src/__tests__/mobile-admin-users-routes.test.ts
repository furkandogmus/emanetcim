import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil admin kullanici uclari: ADMIN olmayana 403, goruntuleme oturumunda her
 * yazan uc kapali, govde dogrulamasi ve servis hata kodlarinin HTTP karsiligi.
 * Kurallarin kendisi `admin-user-management.test.ts`te (servis).
 */

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
const rl = vi.hoisted(() => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => rl);
const svc = vi.hoisted(() => ({
  changeRole: vi.fn(),
  sendPasswordReset: vi.fn(),
  resendVerificationForUser: vi.fn(),
  getDetail: vi.fn(),
  setBanned: vi.fn(),
}));
vi.mock("@/services/AdminUserService", () => ({ adminUserService: svc }));
const privacy = vi.hoisted(() => ({ anonymizeByAdmin: vi.fn() }));
vi.mock("@/services/AccountPrivacyService", () => ({ accountPrivacyService: privacy }));
const setPw = vi.hoisted(() => ({ adminSetUserPassword: vi.fn() }));
vi.mock("@/services/auth/admin-set-password", () => setPw);
const audit = vi.hoisted(() => ({ listPage: vi.fn(), cachedActionPrefixes: vi.fn() }));
vi.mock("@/services/AuditLogService", () => ({ auditLogService: audit }));

import { signAccessToken, signImpersonationToken } from "@/lib/mobile-auth";
import * as userRoute from "@/app/api/mobile/admin/users/[id]/route";
import * as roleRoute from "@/app/api/mobile/admin/users/[id]/role/route";
import * as resetRoute from "@/app/api/mobile/admin/users/[id]/password-reset/route";
import * as passwordRoute from "@/app/api/mobile/admin/users/[id]/password/route";
import * as verifyRoute from "@/app/api/mobile/admin/users/[id]/verification-email/route";
import * as anonymizeRoute from "@/app/api/mobile/admin/users/[id]/anonymize/route";
import * as auditRoute from "@/app/api/mobile/admin/audit-log/route";

type IdParams = { params: Promise<{ id: string }> };
/** Uclarin donus tipi `auth.error` yuzunden `undefined` da iceriyor; testte yanit sart. */
const must =
  <A extends unknown[]>(f: (...a: A) => Promise<Response | undefined>) =>
  async (...a: A): Promise<Response> => {
    const r = await f(...a);
    if (!r) throw new Error("yanit yok");
    return r;
  };
const getUser = must((r: NextRequest, p: IdParams) => userRoute.GET(r, p));
const banUser = must((r: NextRequest, p: IdParams) => userRoute.PATCH(r, p));
const changeRole = must((r: NextRequest, p: IdParams) => roleRoute.POST(r, p));
const sendReset = must((r: NextRequest, p: IdParams) => resetRoute.POST(r, p));
const setPassword = must((r: NextRequest, p: IdParams) => passwordRoute.POST(r, p));
const resendVerify = must((r: NextRequest, p: IdParams) => verifyRoute.POST(r, p));
const anonymize = must((r: NextRequest, p: IdParams) => anonymizeRoute.POST(r, p));
const auditLog = must((r: NextRequest) => auditRoute.GET(r));

type Role = "ADMIN" | "PARTNER" | "GUEST";
const users: Record<string, { id: string; role: Role; email: string; isBanned: boolean; tokenVersion: number }> = {};
const seed = (id: string, role: Role) => (users[id] = { id, role, email: `${id}@example.test`, isBanned: false, tokenVersion: 0 });

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
  ["rol", changeRole, "/role", { role: "PARTNER" }],
  ["sifirlama e-postasi", sendReset, "/password-reset", {}],
  ["sifre belirleme", setPassword, "/password", { password: "Yeni-sifre9" }],
  ["dogrulama e-postasi", resendVerify, "/verification-email", {}],
  ["silme", anonymize, "/anonymize", { confirm: "u1@example.test", reason: "istek uzerine" }],
  ["yasak", banUser, "", { isBanned: true }],
];

let adminToken: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
  delete process.env.MOBILE_JWT_SECRET;
});

beforeEach(async () => {
  for (const k of Object.keys(users)) delete users[k];
  seed("admin-1", "ADMIN");
  seed("guest-1", "GUEST");
  seed("partner-1", "PARTNER");
  db.user.findUnique.mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => users[where.id] ?? null);
  rl.rateLimit.mockReset().mockResolvedValue(true);
  for (const f of Object.values(svc)) f.mockReset().mockResolvedValue({ ok: true });
  privacy.anonymizeByAdmin.mockReset().mockResolvedValue({ ok: true });
  audit.listPage.mockReset();
  audit.cachedActionPrefixes.mockReset();
  setPw.adminSetUserPassword.mockReset().mockResolvedValue({ ok: true, phone: null, name: null });
  adminToken = await signAccessToken("admin-1", "ADMIN", 0);
});

describe("yetki kapilari", () => {
  it.each(MUTATING)("%s: ADMIN olmayana 403, servis cagrilmaz", async (_l, handler, suffix, body) => {
    const token = await signAccessToken("partner-1", "PARTNER", 0);
    const res = await handler(req("POST", `/api/mobile/admin/users/u1${suffix}`, token, body), params("u1"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
    expect(Object.values(svc).some((f) => f.mock.calls.length > 0)).toBe(false);
    expect(privacy.anonymizeByAdmin).not.toHaveBeenCalled();
    expect(setPw.adminSetUserPassword).not.toHaveBeenCalled();
  });

  it.each(MUTATING)("%s: goruntuleme oturumunda kapali", async (_l, handler, suffix, body) => {
    const { token } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    const res = await handler(req("POST", `/api/mobile/admin/users/u1${suffix}`, token, body), params("u1"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_allowed_while_impersonating");
  });

  it("denetim kaydi ADMIN olmayana 403", async () => {
    const token = await signAccessToken("guest-1", "GUEST", 0);
    const res = await auditLog(req("GET", "/api/mobile/admin/audit-log", token));
    expect(res.status).toBe(403);
    expect(audit.listPage).not.toHaveBeenCalled();
  });
});

describe("rol ucu", () => {
  it("gecersiz rol 400", async () => {
    const res = await changeRole(req("POST", "/x", adminToken, { role: "ROOT" }), params("u1"));
    expect(res.status).toBe(400);
    expect(svc.changeRole).not.toHaveBeenCalled();
  });

  it("servise aktor ile gider, sonuc durumu doner", async () => {
    svc.changeRole.mockResolvedValue({ ok: true, status: "pending_approval" });
    const res = await changeRole(req("POST", "/x", adminToken, { role: "ADMIN" }), params("u1"));
    expect(await res.json()).toEqual({ ok: true, status: "pending_approval" });
    expect(svc.changeRole).toHaveBeenCalledWith("u1", "ADMIN", expect.objectContaining({ userId: "admin-1" }));
  });

  it.each([
    ["cannot_demote_sole_admin", 409],
    ["cannot_change_self", 409],
    ["pending_exists", 409],
    ["not_found", 404],
  ])("%s -> %i", async (error, status) => {
    svc.changeRole.mockResolvedValue({ ok: false, error });
    const res = await changeRole(req("POST", "/x", adminToken, { role: "GUEST" }), params("u1"));
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(error);
  });
});

describe("silme ucu", () => {
  it("onay ve gerekce olmadan 400, servis cagrilmaz", async () => {
    const res = await anonymize(req("POST", "/x", adminToken, { reason: "x" }), params("u1"));
    expect(res.status).toBe(400);
    expect(privacy.anonymizeByAdmin).not.toHaveBeenCalled();
  });

  it("onay metni ve gerekce servise oldugu gibi gider", async () => {
    const res = await anonymize(req("POST", "/x", adminToken, { confirm: "a@b.c", reason: "talep" }), params("g1"));
    expect(res.status).toBe(200);
    expect(privacy.anonymizeByAdmin).toHaveBeenCalledWith({
      targetUserId: "g1",
      actor: expect.objectContaining({ userId: "admin-1" }),
      confirm: "a@b.c",
      reason: "talep",
    });
  });

  it.each([
    ["confirm_mismatch", 400],
    ["active_bookings", 409],
    ["not_guest", 409],
    ["cannot_delete_self", 409],
  ])("%s -> %i", async (reason, status) => {
    privacy.anonymizeByAdmin.mockResolvedValue({ ok: false, reason });
    const res = await anonymize(req("POST", "/x", adminToken, { confirm: "a", reason: "talep" }), params("g1"));
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(reason);
  });
});

describe("e-posta uclari", () => {
  it("sifirlama: hiz siniri 429, servis cagrilmaz", async () => {
    rl.rateLimit.mockResolvedValue(false);
    const res = await sendReset(req("POST", "/x", adminToken, {}), params("u1"));
    expect(res.status).toBe(429);
    expect(svc.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("sifirlama: istemci dili gecer, e-postasiz hesap 409 no_email", async () => {
    svc.sendPasswordReset.mockResolvedValue({ ok: false, error: "no_email" });
    const res = await sendReset(req("POST", "/x", adminToken, { locale: "en" }), params("u1"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("no_email");
    expect(svc.sendPasswordReset).toHaveBeenCalledWith("u1", expect.anything(), "en");
  });

  it("dogrulama: already_verified 409", async () => {
    svc.resendVerificationForUser.mockResolvedValue({ ok: false, error: "already_verified" });
    const res = await resendVerify(req("POST", "/x", adminToken, {}), params("u1"));
    expect(res.status).toBe(409);
  });

  it("sifre belirleme: sifre yanitta yok; admin hedef 403", async () => {
    const ok = await setPassword(req("POST", "/x", adminToken, { password: "Yeni-sifre9" }), params("u1"));
    expect(JSON.stringify(await ok.json())).not.toContain("Yeni-sifre9");
    setPw.adminSetUserPassword.mockResolvedValue({ ok: false, reason: "forbidden_target" });
    const res = await setPassword(req("POST", "/x", adminToken, { password: "Yeni-sifre9" }), params("u1"));
    expect(res.status).toBe(403);
  });
});

describe("okuma uclari", () => {
  it("detay yoksa 404", async () => {
    svc.getDetail.mockResolvedValue(null);
    const res = await getUser(req("GET", "/x", adminToken), params("u1"));
    expect(res.status).toBe(404);
  });

  it("denetim kaydi: suzulmemis ilk sayfa onekleri tasir", async () => {
    audit.listPage.mockResolvedValue({ items: [], nextCursor: null });
    audit.cachedActionPrefixes.mockResolvedValue(["user."]);
    const res = await auditLog(req("GET", "/api/mobile/admin/audit-log", adminToken));
    expect(await res.json()).toEqual({ entries: [], nextCursor: null, prefixes: ["user."] });
  });

  it("denetim kaydi: onek ve kullanici filtreye girer, suzulu istek onek sormaz", async () => {
    audit.listPage.mockResolvedValue({ items: [], nextCursor: null });
    const res = await auditLog(req("GET", "/api/mobile/admin/audit-log?action=user.&userId=u1", adminToken));
    expect(await res.json()).toEqual({ entries: [], nextCursor: null });
    expect(audit.listPage).toHaveBeenCalledWith({ actionPrefix: "user.", userId: "u1" }, { cursor: null, take: 30 });
    expect(audit.cachedActionPrefixes).not.toHaveBeenCalled();
  });

  it("denetim kaydi: gecersiz onek yok sayilir, sonraki sayfa onek sormaz", async () => {
    audit.listPage.mockResolvedValue({ items: [], nextCursor: null });
    await auditLog(req("GET", "/api/mobile/admin/audit-log?action=%25'%3B&cursor=c1", adminToken));
    expect(audit.listPage).toHaveBeenCalledWith({ actionPrefix: null, userId: null }, { cursor: "c1", take: 30 });
    expect(audit.cachedActionPrefixes).not.toHaveBeenCalled();
  });
});
