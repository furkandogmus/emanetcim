import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Web "olarak goruntule" (M5). Kurallar: yalniz admin baslatir, admin hedef reddedilir,
 * 30 dk sonra kendiliginden biter, durdurmak cerezi siler ve adminin oturumu geri gelir,
 * baslatma ve bitis denetim kaydina yazilir, goruntuleme sirasinda yazma kapali.
 */

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  audit: vi.fn(),
  cookieSet: vi.fn(),
  userFindUnique: vi.fn(),
  startImpersonation: vi.fn(),
  cookieGet: vi.fn(),
  headerGet: vi.fn(),
  headerHas: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/lib/client-ip", () => ({
  getClientIpOrNull: vi.fn().mockResolvedValue("203.0.113.7"),
  clientIpFromRequest: vi.fn(() => "203.0.113.7"),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: m.cookieSet, get: m.cookieGet })),
  headers: vi.fn(async () => ({ get: m.headerGet, has: m.headerHas })),
}));
vi.mock("@/lib/db", () => ({ default: { user: { findUnique: m.userFindUnique } } }));
vi.mock("@/services/AdminUserService", () => ({
  adminUserService: { startImpersonation: m.startImpersonation },
}));

import {
  WEB_IMPERSONATION_COOKIE,
  WEB_IMPERSONATION_TTL_SECONDS,
  WEB_IMPERSONATION_STAMP_HEADER,
  impersonationGate,
  impersonationProxyDecision,
  impersonationStamp,
  normalizeProxyPath,
  signWebImpersonation,
  withForwardedHeaders,
  verifyWebImpersonation,
} from "@/lib/web-impersonation";
import { readWebImpersonation, resolveWebImpersonation } from "@/lib/web-impersonation-session";
import { asImpersonationRead } from "@/lib/impersonation-read-scope";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { rejectIfImpersonating } from "@/lib/impersonation-guard";
import { IMPERSONATION_TTL_SECONDS } from "@/lib/mobile-auth";
import { startImpersonationAction } from "@/actions/admin-impersonation";
import { POST as stopRoute } from "@/app/api/impersonation/stop/route";
import { actionSession, requireUser } from "@/lib/action-auth";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const T0 = new Date("2026-11-24T10:00:00Z");

const targetRow = {
  id: TARGET,
  role: "GUEST",
  name: "Test Misafir",
  email: "guest@example.test",
  image: null,
  emailVerified: null,
  isBanned: false,
  tokenVersion: 3,
};

async function cookieFor(overrides: Partial<{ targetTv: number; adminTv: number; adminId: string }> = {}) {
  const s = await signWebImpersonation({
    targetId: TARGET,
    targetTv: 3,
    adminId: ADMIN,
    adminTv: 1,
    now: T0,
    ...overrides,
  });
  return s!.token;
}

const adminToken = { sub: ADMIN, role: "ADMIN" as const, tv: 1 };

describe("web olarak goruntule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-for-web-impersonation-0123456789";
  });
  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("sure mobil ile ayni: 30 dakika", () => {
    expect(WEB_IMPERSONATION_TTL_SECONDS).toBe(IMPERSONATION_TTL_SECONDS);
  });

  describe("baslatma", () => {
    it("admin olmayan baslatamaz; servis cagrilmaz, cerez basilmaz", async () => {
      m.auth.mockResolvedValue({ user: { id: "p-1", role: "PARTNER" } });
      const r = await startImpersonationAction(TARGET);
      expect(r.ok).toBe(false);
      expect(m.startImpersonation).not.toHaveBeenCalled();
      expect(m.cookieSet).not.toHaveBeenCalled();
    });

    it("goruntuleme sirasinda (oturum hedefin) zincirleme baslatilamaz", async () => {
      m.auth.mockResolvedValue({
        user: { id: TARGET, role: "GUEST" },
        impersonation: { adminId: ADMIN, expiresAt: T0.toISOString() },
      });
      const r = await startImpersonationAction(TARGET);
      expect(r.ok).toBe(false);
      expect(m.cookieSet).not.toHaveBeenCalled();
    });

    it("admin hedef reddedilir, cerez basilmaz", async () => {
      m.auth.mockResolvedValue({ user: { id: ADMIN, role: "ADMIN" } });
      m.userFindUnique.mockResolvedValue({ tokenVersion: 1 });
      m.startImpersonation.mockResolvedValue({ ok: false, error: "cannot_impersonate_admin" });
      const r = await startImpersonationAction(TARGET);
      expect(r).toEqual({ ok: false, error: "cannot_impersonate_admin" });
      expect(m.cookieSet).not.toHaveBeenCalled();
    });

    it("admin baslatir: servis (denetim kaydi orada) cagrilir, httpOnly strict cerez 30 dk", async () => {
      m.auth.mockResolvedValue({ user: { id: ADMIN, role: "ADMIN" } });
      m.userFindUnique.mockResolvedValue({ tokenVersion: 1 });
      m.startImpersonation.mockResolvedValue({ ok: true, target: { id: TARGET, tokenVersion: 3 } });
      const r = await startImpersonationAction(TARGET);
      expect(r.ok).toBe(true);
      expect(m.startImpersonation).toHaveBeenCalledWith(TARGET, { userId: ADMIN, ip: "203.0.113.7" }, "web");
      const [name, token, opts] = m.cookieSet.mock.calls[0];
      expect(name).toBe(WEB_IMPERSONATION_COOKIE);
      expect(opts).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
      const claims = await verifyWebImpersonation(token, { adminId: ADMIN });
      expect(claims).toMatchObject({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      const ttl = (opts.expires as Date).getTime() - Date.now();
      expect(ttl).toBeGreaterThan((WEB_IMPERSONATION_TTL_SECONDS - 5) * 1000);
      expect(ttl).toBeLessThanOrEqual(WEB_IMPERSONATION_TTL_SECONDS * 1000);
    });
  });

  describe("oturum cozumu", () => {
    const at = new Date(T0.getTime() + 60_000);

    it("gecerli cerez + ADMIN oturumu: hedef", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      const v = await resolveWebImpersonation(adminToken, await cookieFor(), at);
      expect(v.kind).toBe("active");
      if (v.kind === "active") {
        expect(v.target).toMatchObject({ id: TARGET, role: "GUEST" });
        expect(v.adminId).toBe(ADMIN);
      }
    });

    it("30 dakika dolunca gecersiz", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      const later = new Date(T0.getTime() + (WEB_IMPERSONATION_TTL_SECONDS + 1) * 1000);
      expect((await resolveWebImpersonation(adminToken, await cookieFor(), later)).kind).toBe("stale");
    });

    it("baska admine basilmis cerez ya da ADMIN olmayan oturum: hedef yok", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      const c = await cookieFor();
      expect((await resolveWebImpersonation({ sub: "33333333-3333-4333-8333-333333333333", role: "ADMIN" }, c, at)).kind).toBe("stale");
      expect((await resolveWebImpersonation({ sub: ADMIN, role: "PARTNER" }, c, at)).kind).toBe("stale");
    });

    it("hedef ADMIN oldu, yasaklandi, silindi ya da tokenVersion degisti: stale (serit yalniz Cik)", async () => {
      const c = await cookieFor();
      for (const row of [
        { ...targetRow, role: "ADMIN" },
        { ...targetRow, isBanned: true },
        { ...targetRow, tokenVersion: 4 },
        { ...targetRow, email: "deleted-x@invalid.local" },
        null,
      ]) {
        m.userFindUnique.mockResolvedValueOnce(row);
        expect((await resolveWebImpersonation(adminToken, c, at)).kind).toBe("stale");
      }
    });

    it("admin her yerden cikis yaptiysa (tokenVersion) stale", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      expect((await resolveWebImpersonation({ ...adminToken, tv: 2 }, await cookieFor(), at)).kind).toBe("stale");
    });

    it("sahte imza ya da baska sir: gecmez", async () => {
      const c = await cookieFor();
      const tampered = c.slice(0, -2) + (c.endsWith("A") ? "BB" : "AA");
      expect(await verifyWebImpersonation(tampered, { now: T0 })).toBeNull();
      process.env.AUTH_SECRET = "another-secret-entirely-0123456789abcdef";
      expect(await verifyWebImpersonation(c, { now: T0 })).toBeNull();
    });
  });

  describe("proxy kapisi (gercek token bicimi)", () => {
    // `auth.ts` jwt callback'i `id` yazmaz, yalniz `sub`: proxy kimligi oradan okumali.
    async function proxyUser(token: Record<string, unknown>) {
      const session = await authConfig.callbacks!.session!({
        session: { user: {}, expires: "" },
        token,
      } as never);
      return (session as { user: { id?: string; role?: string } }).user;
    }

    it("sub'lu ADMIN token'inda gecerli cerez damgalanir", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      const authUser = await proxyUser({ sub: ADMIN, role: "ADMIN", tv: 1, rv: 0 });
      expect(authUser.id).toBe(ADMIN);
      const gate = await impersonationGate({
        cookie: live!.token,
        authUser,
        method: "GET",
        pathname: "/tr/bookings",
        isServerAction: false,
        isAdminPath: false,
      });
      expect(gate.decision).toBe("pass");
      expect(gate.stamp).toBe(await impersonationStamp(live!.token));
    });

    it("gecerli goruntulemede route handler yazmasi kesilir, server action damgayla gecer", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      const authUser = await proxyUser({ sub: ADMIN, role: "ADMIN" });
      const common = { cookie: live!.token, authUser, isAdminPath: false };
      expect((await impersonationGate({ ...common, method: "POST", pathname: "/api/push/subscribe", isServerAction: false })).decision).toBe("block");
      expect((await impersonationGate({ ...common, method: "POST", pathname: "/tr/account", isServerAction: false })).decision).toBe("block");
      const action = await impersonationGate({ ...common, method: "POST", pathname: "/tr/search", isServerAction: true });
      expect(action.decision).toBe("pass");
      expect(action.stamp).not.toBeNull();
    });

    it("baska kullanicinin oturumunda cerez temizlenir, damga yok", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      const authUser = await proxyUser({ sub: "33333333-3333-4333-8333-333333333333", role: "ADMIN" });
      const gate = await impersonationGate({
        cookie: live!.token,
        authUser,
        method: "POST",
        pathname: "/tr",
        isServerAction: true,
        isAdminPath: false,
      });
      expect(gate).toEqual({ decision: "clear_cookie", stamp: null });
    });
  });

  describe("oturum callback damgasi", () => {
    async function setRequest(cookie: string | null, stamp: string | null, isAction = false) {
      m.cookieGet.mockImplementation((n: string) => (cookie && n === WEB_IMPERSONATION_COOKIE ? { value: cookie } : undefined));
      m.headerGet.mockImplementation((n: string) => (n === WEB_IMPERSONATION_STAMP_HEADER ? stamp : null));
      m.headerHas.mockImplementation((n: string) => n === "next-action" && isAction);
    }

    it("damgasiz istek (proxy'yi atlayan yol) goruntulemeyi onurlandirmaz", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      m.userFindUnique.mockResolvedValue(targetRow);
      await setRequest(live!.token, null);
      expect(await readWebImpersonation(adminToken)).toBeNull();
      await setRequest(live!.token, "f".repeat(64));
      expect(await readWebImpersonation(adminToken)).toBeNull();
    });

    it("damgali sayfa isteginde hedef; server action'da kimliksiz; okuma kapsaminda hedef", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      const stamp = await impersonationStamp(live!.token);
      m.userFindUnique.mockResolvedValue(targetRow);
      await setRequest(live!.token, stamp);
      expect((await readWebImpersonation(adminToken))?.mode).toBe("target");
      await setRequest(live!.token, stamp, true);
      expect((await readWebImpersonation(adminToken))?.mode).toBe("anonymous");
      expect((await asImpersonationRead(() => readWebImpersonation(adminToken)))?.mode).toBe("target");
    });

    it("damgali ama hedef gecersiz: stale", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      m.userFindUnique.mockResolvedValue({ ...targetRow, isBanned: true });
      await setRequest(live!.token, await impersonationStamp(live!.token));
      expect((await readWebImpersonation(adminToken))?.mode).toBe("stale");
    });

    it("cerez yoksa (durdurulduysa) oturum adminin kendisi", async () => {
      await setRequest(null, null);
      expect(await readWebImpersonation(adminToken)).toBeNull();
      expect(m.userFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("durdurma", () => {
    function req(cookie?: string, h: Record<string, string> = { "sec-fetch-site": "same-origin", origin: "https://example.test", host: "example.test" }) {
      return {
        cookies: { get: (n: string) => (cookie && n === WEB_IMPERSONATION_COOKIE ? { value: cookie } : undefined) },
        headers: new Headers(h),
      } as unknown as Parameters<typeof stopRoute>[0];
    }

    it("cerezi siler ve bitis kaydini adminin adina yazar", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      const res = await stopRoute(req(live!.token));
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie") ?? "").toContain(`${WEB_IMPERSONATION_COOKIE}=;`);
      expect(m.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: ADMIN,
          action: "admin.impersonate.stop",
          entityType: "User",
          entityId: TARGET,
          metadata: { channel: "web" },
        }),
      );
    });

    it("baska siteden gelen istek reddedilir, kayit yazilmaz", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      expect((await stopRoute(req(live!.token, { "sec-fetch-site": "cross-site", origin: "https://evil.example" }))).status).toBe(403);
      expect((await stopRoute(req(live!.token, { origin: "https://evil.example", host: "example.test" }))).status).toBe(403);
      expect(m.audit).not.toHaveBeenCalled();
    });

    it("gecersiz cerezde de cerezi siler ama denetim kaydi yazmaz", async () => {
      const res = await stopRoute(req("not-a-token"));
      expect(res.status).toBe(200);
      expect(m.audit).not.toHaveBeenCalled();
    });
  });

  describe("salt okunur", () => {
    const base = { valid: true, isAdminPath: false, isServerAction: false };
    it("route handler yazmalari ve JS'siz form POST'u kesilir; durdurma acik; cikis cerezi siler", () => {
      expect(impersonationProxyDecision({ ...base, method: "POST", pathname: "/tr/account" })).toBe("block");
      expect(impersonationProxyDecision({ ...base, method: "DELETE", pathname: "/api/x" })).toBe("block");
      expect(impersonationProxyDecision({ ...base, method: "POST", pathname: "/api/impersonation/stop" })).toBe("pass");
      expect(impersonationProxyDecision({ ...base, method: "POST", pathname: "/api/auth/signout" })).toBe("clear_cookie");
      expect(impersonationProxyDecision({ ...base, isServerAction: true, method: "POST", pathname: "/tr/search" })).toBe("pass");
    });

    it("okuma gecer; veri disa aktarimi kapali; yonetici paneli ana sayfaya", () => {
      expect(impersonationProxyDecision({ ...base, method: "GET", pathname: "/tr/bookings" })).toBe("pass");
      expect(impersonationProxyDecision({ ...base, method: "GET", pathname: "/api/account/data-export" })).toBe("block");
      expect(impersonationProxyDecision({ ...base, isAdminPath: true, method: "GET", pathname: "/tr/admin" })).toBe("redirect_home");
    });

    it("kodlanmis ya da sonda egik cizgili yol blok listesini atlatamaz; cozulemeyen kodlama engellenir", () => {
      for (const p of ["/api/account/data%2Dexport", "/api/account/data-export/", "/api/account/%64ata-export", "/API/account/data-export", "/api//account/data-export"]) {
        expect(impersonationProxyDecision({ ...base, method: "GET", pathname: p }), p).toBe("block");
      }
      expect(impersonationProxyDecision({ ...base, method: "GET", pathname: "/tr/%E0%A4%A" })).toBe("block");
      for (const p of ["/api/account/data-export", "/api/account/data%2Dexport", "/api/account/data-export/"]) {
        for (const isServerAction of [false, true]) {
          expect(impersonationProxyDecision({ ...base, isServerAction, method: "POST", pathname: p }), `POST ${p}`).toBe("block");
        }
      }
      expect(normalizeProxyPath("/api/impersonation/stop/")).toBe("/api/impersonation/stop");
    });

    it("/api'ye sahte Next-Action basligiyla yazma kesilir", () => {
      expect(impersonationProxyDecision({ ...base, method: "DELETE", pathname: "/api/push/subscribe" })).toBe("block");
      for (const p of ["/api/push/subscribe", "/api/account/data-export", "/api"]) {
        expect(impersonationProxyDecision({ ...base, isServerAction: true, method: "POST", pathname: p }), p).toBe("block");
      }
      expect(impersonationProxyDecision({ ...base, isServerAction: true, method: "POST", pathname: "/api/impersonation/stop" })).toBe("pass");
    });

    it("route kilidi: goruntuleme ve stale oturumda 403", async () => {
      expect(rejectIfImpersonating({ user: { id: TARGET }, impersonation: { adminId: ADMIN, expiresAt: "" } } as never)?.status).toBe(403);
      expect(rejectIfImpersonating({ user: { id: ADMIN }, impersonation: { stale: true, expiresAt: null } } as never)?.status).toBe(403);
      expect(rejectIfImpersonating({ user: { id: ADMIN } } as never)).toBeNull();
    });

    it("basliksiz next() yanitina da temizlenmis basliklar iletilir (istemci damgasi duser)", () => {
      const h = new Headers({ "x-keep": "1" });
      const res = withForwardedHeaders(NextResponse.next(), h);
      expect(res.headers.get("x-middleware-override-headers")).toBe("x-keep");
      expect(res.headers.get(`x-middleware-request-${WEB_IMPERSONATION_STAMP_HEADER}`)).toBeNull();
      const already = NextResponse.next({ request: { headers: new Headers({ a: "1" }) } });
      expect(withForwardedHeaders(already, h).headers.get("x-middleware-override-headers")).toBe("a");
      expect(withForwardedHeaders(NextResponse.next(), null).headers.has("x-middleware-override-headers")).toBe(false);
    });

    it("gecersiz cerez temizlenir", () => {
      expect(impersonationProxyDecision({ ...base, valid: false, method: "POST", pathname: "/tr" })).toBe("clear_cookie");
    });

    it("action kapilari: rol kapisi her zaman, actionSession okuma kapsami disinda reddeder", async () => {
      const imp = { adminId: ADMIN, expiresAt: T0.toISOString() };
      m.auth.mockResolvedValue({ user: { id: TARGET, role: "GUEST" }, impersonation: imp });
      expect((await requireUser()).ok).toBe(false);
      expect(await actionSession()).toBeNull();
      expect((await asImpersonationRead(() => actionSession()))?.user.id).toBe(TARGET);
      m.auth.mockResolvedValue({ user: { id: ADMIN, role: "ADMIN" }, impersonation: { stale: true, expiresAt: null } });
      expect((await requireUser()).ok).toBe(false);
      expect(await asImpersonationRead(() => actionSession())).toBeNull();
    });
  });
});
