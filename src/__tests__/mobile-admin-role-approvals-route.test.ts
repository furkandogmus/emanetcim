import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil admin rol onayi uclari: ADMIN olmayana 403, goruntuleme oturumunda yazan uclar
 * kapali, servis hata kodlarinin HTTP karsiligi, liste DTO'su. Kurallarin kendisi
 * `AdminUserService` (web action'i da onu cagirir; yaris testi `role-approval-race`).
 */

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
const svc = vi.hoisted(() => ({
  listRoleChangeRequests: vi.fn(),
  approveRoleChange: vi.fn(),
  cancelRoleChange: vi.fn(),
}));
vi.mock("@/services/AdminUserService", () => ({ adminUserService: svc }));

import { signAccessToken, signImpersonationToken } from "@/lib/mobile-auth";
import * as listRoute from "@/app/api/mobile/admin/role-approvals/route";
import * as approveRoute from "@/app/api/mobile/admin/role-approvals/[id]/approve/route";
import * as rejectRoute from "@/app/api/mobile/admin/role-approvals/[id]/reject/route";

type IdParams = { params: Promise<{ id: string }> };
const must =
  <A extends unknown[]>(f: (...a: A) => Promise<Response | undefined>) =>
  async (...a: A): Promise<Response> => {
    const r = await f(...a);
    if (!r) throw new Error("yanit yok");
    return r;
  };
const list = must((r: NextRequest) => listRoute.GET(r));
const approve = must((r: NextRequest, p: IdParams) => approveRoute.POST(r, p));
const reject = must((r: NextRequest, p: IdParams) => rejectRoute.POST(r, p));

const users: Record<string, { id: string; role: string; isBanned: boolean; tokenVersion: number }> = {
  "admin-1": { id: "admin-1", role: "ADMIN", isBanned: false, tokenVersion: 0 },
  "partner-1": { id: "partner-1", role: "PARTNER", isBanned: false, tokenVersion: 0 },
  "guest-1": { id: "guest-1", role: "GUEST", isBanned: false, tokenVersion: 0 },
};
const req = (method: string, token: string) =>
  new NextRequest("http://localhost/api/mobile/admin/role-approvals", {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

let adminToken: string;

beforeAll(() => {
  process.env.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
  delete process.env.MOBILE_JWT_SECRET;
});

beforeEach(async () => {
  db.user.findUnique.mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => users[where.id] ?? null);
  for (const f of Object.values(svc)) f.mockReset().mockResolvedValue({ ok: true });
  adminToken = await signAccessToken("admin-1", "ADMIN", 0);
});

describe("yetki kapilari", () => {
  it("liste ADMIN olmayana 403", async () => {
    const token = await signAccessToken("partner-1", "PARTNER", 0);
    const res = await list(req("GET", token));
    expect(res.status).toBe(403);
    expect(svc.listRoleChangeRequests).not.toHaveBeenCalled();
  });

  it.each([
    ["onay", approve],
    ["red", reject],
  ] as const)("%s: ADMIN olmayana 403, goruntuleme oturumunda kapali", async (_l, handler) => {
    const partner = await signAccessToken("partner-1", "PARTNER", 0);
    expect((await handler(req("POST", partner), params("r1"))).status).toBe(403);

    const { token } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    const res = await handler(req("POST", token), params("r1"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_allowed_while_impersonating");
    expect(svc.approveRoleChange).not.toHaveBeenCalled();
    expect(svc.cancelRoleChange).not.toHaveBeenCalled();
  });
});

describe("liste", () => {
  it("DTO doner; kendi istegi isOwnRequest ile isaretli", async () => {
    svc.listRoleChangeRequests.mockResolvedValue([
      {
        id: "r1",
        previousRole: "PARTNER",
        requestedRole: "ADMIN",
        createdAt: new Date("2026-11-23T10:00:00Z"),
        requestedByUserId: "admin-1",
        targetUserId: "partner-1",
        targetUser: { id: "partner-1", name: "Esnaf", email: "e@example.test", role: "PARTNER" },
        requestedBy: { id: "admin-1", name: "Yonetici", email: "a@example.test" },
      },
    ]);
    const res = await list(req("GET", adminToken));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: "r1",
        previousRole: "PARTNER",
        requestedRole: "ADMIN",
        createdAt: "2026-11-23T10:00:00.000Z",
        target: { id: "partner-1", name: "Esnaf", email: "e@example.test", role: "PARTNER" },
        requestedBy: { id: "admin-1", name: "Yonetici", email: "a@example.test" },
        isOwnRequest: true,
      },
    ]);
  });
});

describe("onay ve red", () => {
  it("onay servise aktor ile gider", async () => {
    const res = await approve(req("POST", adminToken), params("r1"));
    expect(res.status).toBe(200);
    expect(svc.approveRoleChange).toHaveBeenCalledWith("r1", expect.objectContaining({ userId: "admin-1" }));
  });

  it.each([
    ["cannot_self_approve", 403],
    ["not_found", 404],
    ["stale", 409],
    ["cannot_demote_sole_admin", 409],
  ] as const)("onay hatasi %s -> %i, kod doner", async (error, status) => {
    svc.approveRoleChange.mockResolvedValue({ ok: false, error });
    const res = await approve(req("POST", adminToken), params("r1"));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("red servise aktor ile gider; bulunamazsa 404", async () => {
    expect((await reject(req("POST", adminToken), params("r1"))).status).toBe(200);
    expect(svc.cancelRoleChange).toHaveBeenCalledWith("r1", expect.objectContaining({ userId: "admin-1" }));
    svc.cancelRoleChange.mockResolvedValue({ ok: false, error: "not_found" });
    const res = await reject(req("POST", adminToken), params("r1"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
