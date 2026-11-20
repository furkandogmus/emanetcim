import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Yonetici "kullanici olarak gir": token `imp` tasir, admin her istekte yeniden
 * dogrulanir, hesap silme / push kaydi / refresh goruntuleme oturumunda kapali.
 */

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ default: db }));
const audit = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/audit-log", () => audit);
const privacy = vi.hoisted(() => ({ anonymizeSelf: vi.fn() }));
vi.mock("@/services/AccountPrivacyService", () => ({ accountPrivacyService: privacy }));

import {
  requireMobileUser,
  signAccessToken,
  signImpersonationToken,
  verifyMobileToken,
} from "@/lib/mobile-auth";
import { POST as impersonate } from "@/app/api/mobile/admin/users/[id]/impersonate/route";
import { POST as deleteAccount } from "@/app/api/mobile/account/delete/route";
import { POST as refresh } from "@/app/api/mobile/auth/refresh/route";

type Row = { id: string; role: "ADMIN" | "PARTNER" | "GUEST"; isBanned: boolean; tokenVersion: number };
let users: Record<string, Row & { email: string; name: string; phone: null; image: null; emailVerified: null }>;

function seed(id: string, role: Row["role"], extra: Partial<Row> = {}) {
  users[id] = {
    id,
    role,
    isBanned: false,
    tokenVersion: 0,
    email: `${id}@example.test`,
    name: id,
    phone: null,
    image: null,
    emailVerified: null,
    ...extra,
  };
}

function req(method: string, path: string, token?: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(() => {
  // Her kosuda rastgele: depoda sabit sir durmasin.
  process.env.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
  delete process.env.MOBILE_JWT_SECRET;
});

beforeEach(() => {
  users = {};
  seed("admin-1", "ADMIN");
  seed("admin-2", "ADMIN");
  seed("guest-1", "GUEST");
  seed("partner-1", "PARTNER");
  db.user.findUnique.mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => {
    return users[where.id] ?? null;
  });
  audit.writeAuditLog.mockReset();
  privacy.anonymizeSelf.mockReset().mockResolvedValue({ ok: true });
});

describe("signImpersonationToken", () => {
  it("token `imp`, hedefin id'si ve 30 dk sure tasir", async () => {
    const { token, expiresAt } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    const claims = await verifyMobileToken(token);
    expect(claims.sub).toBe("guest-1");
    expect(claims.type).toBe("access");
    expect(claims.imp).toBe("admin-1");
    expect(claims.exp * 1000).toBe(Math.floor(expiresAt.getTime() / 1000) * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60 * 1000);
  });

  it("requireMobileUser impersonatedBy doldurur, GET denetim yazmaz, POST yazar", async () => {
    const { token } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    const get = await requireMobileUser(req("GET", "/api/mobile/bookings", token));
    expect("user" in get && get.user?.impersonatedBy).toBe("admin-1");
    expect(audit.writeAuditLog).not.toHaveBeenCalled();

    await requireMobileUser(req("POST", "/api/mobile/bookings/b1/cancel", token));
    expect(audit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.impersonate.request",
        actorUserId: "admin-1",
        entityType: "User",
        entityId: "guest-1",
        metadata: { method: "POST", path: "/api/mobile/bookings/b1/cancel" },
      }),
    );
  });

  it("normal token impersonatedBy tasimaz", async () => {
    const token = await signAccessToken("guest-1", "GUEST", 0);
    const r = await requireMobileUser(req("POST", "/api/mobile/x", token));
    expect("user" in r && r.user?.impersonatedBy).toBeUndefined();
    expect(audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["yetkisi alinmis", () => (users["admin-1"].role = "GUEST")],
    ["yasaklanmis", () => (users["admin-1"].isBanned = true)],
    ["silinmis", () => delete users["admin-1"]],
  ])("%s admin'in token'i 401", async (_label, mutate) => {
    const { token } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    mutate();
    const r = await requireMobileUser(req("GET", "/api/mobile/bookings", token));
    expect("error" in r && r.error?.status).toBe(401);
  });

  it("refresh ucu goruntuleme token'ini reddeder", async () => {
    const { token } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    const res = (await refresh(req("POST", "/api/mobile/auth/refresh", undefined, { refreshToken: token })))!;
    expect(res.status).toBe(401);
  });
});

describe("POST /api/mobile/admin/users/[id]/impersonate", () => {
  it("admin misafir olarak girer: token + user DTO + denetim", async () => {
    const adminToken = await signAccessToken("admin-1", "ADMIN", 0);
    const res = (await impersonate(req("POST", "/api/mobile/admin/users/guest-1/impersonate", adminToken), params("guest-1")))!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: "guest-1", role: "GUEST" });
    expect(typeof body.expiresAt).toBe("string");
    expect(body.refreshToken).toBeUndefined();
    expect((await verifyMobileToken(body.accessToken)).imp).toBe("admin-1");
    expect(audit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.impersonate.start", entityId: "guest-1" }),
    );
  });

  it("admin olmayan cagiramaz", async () => {
    const t = await signAccessToken("partner-1", "PARTNER", 0);
    const res = (await impersonate(req("POST", "/x", t), params("guest-1")))!;
    expect(res.status).toBe(403);
  });

  it("admin baska bir admin olarak giremez", async () => {
    const t = await signAccessToken("admin-1", "ADMIN", 0);
    const res = (await impersonate(req("POST", "/x", t), params("admin-2")))!;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("cannot_impersonate_admin");
  });

  it("yasakli hedef reddedilir", async () => {
    users["guest-1"].isBanned = true;
    const t = await signAccessToken("admin-1", "ADMIN", 0);
    const res = (await impersonate(req("POST", "/x", t), params("guest-1")))!;
    expect(res.status).toBe(403);
  });
});

describe("goruntuleme oturumunda kapali uclar", () => {
  it("hesap silme 403 not_allowed_while_impersonating", async () => {
    const { token } = await signImpersonationToken("guest-1", "GUEST", "admin-1", 0);
    const res = (await deleteAccount(req("POST", "/api/mobile/account/delete", token)))!;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_allowed_while_impersonating");
    expect(privacy.anonymizeSelf).not.toHaveBeenCalled();
  });

  it("kullanicinin kendisi hesabini silebilir (kapi yalniz goruntulemede)", async () => {
    const token = await signAccessToken("guest-1", "GUEST", 0);
    const res = (await deleteAccount(req("POST", "/api/mobile/account/delete", token)))!;
    expect(res.status).toBe(200);
  });
});
