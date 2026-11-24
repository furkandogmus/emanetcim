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
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/lib/client-ip", () => ({
  getClientIpOrNull: vi.fn().mockResolvedValue("203.0.113.7"),
  clientIpFromRequest: vi.fn(() => "203.0.113.7"),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: m.cookieSet, get: vi.fn() })) }));
vi.mock("@/lib/db", () => ({ default: { user: { findUnique: m.userFindUnique } } }));
vi.mock("@/services/AdminUserService", () => ({
  adminUserService: { startImpersonation: m.startImpersonation },
}));

import {
  WEB_IMPERSONATION_COOKIE,
  WEB_IMPERSONATION_TTL_SECONDS,
  impersonationProxyDecision,
  signWebImpersonation,
  verifyWebImpersonation,
} from "@/lib/web-impersonation";
import { resolveWebImpersonation } from "@/lib/web-impersonation-session";
import { IMPERSONATION_TTL_SECONDS } from "@/lib/mobile-auth";
import { startImpersonationAction } from "@/actions/admin-impersonation";
import { POST as stopRoute } from "@/app/api/impersonation/stop/route";
import { requireUser } from "@/lib/action-auth";

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
      expect(m.startImpersonation).toHaveBeenCalledWith(TARGET, { userId: ADMIN, ip: "203.0.113.7" });
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
    it("gecerli cerez + ADMIN oturumu: oturum hedefe doner", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      const v = await resolveWebImpersonation(adminToken, await cookieFor(), new Date(T0.getTime() + 60_000));
      expect(v?.target).toMatchObject({ id: TARGET, role: "GUEST" });
      expect(v?.adminId).toBe(ADMIN);
    });

    it("30 dakika dolunca cerez yok sayilir: oturum yeniden adminin", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      const later = new Date(T0.getTime() + (WEB_IMPERSONATION_TTL_SECONDS + 1) * 1000);
      expect(await resolveWebImpersonation(adminToken, await cookieFor(), later)).toBeNull();
    });

    it("cerez baska admine basildiysa ya da oturum artik ADMIN degilse gecmez", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      const c = await cookieFor();
      const at = new Date(T0.getTime() + 1000);
      expect(await resolveWebImpersonation({ sub: "33333333-3333-4333-8333-333333333333", role: "ADMIN" }, c, at)).toBeNull();
      expect(await resolveWebImpersonation({ sub: ADMIN, role: "PARTNER" }, c, at)).toBeNull();
    });

    it("hedef bu arada ADMIN olduysa, yasaklandiysa ya da tokenVersion degistiyse gecmez", async () => {
      const c = await cookieFor();
      const at = new Date(T0.getTime() + 1000);
      for (const row of [
        { ...targetRow, role: "ADMIN" },
        { ...targetRow, isBanned: true },
        { ...targetRow, tokenVersion: 4 },
      ]) {
        m.userFindUnique.mockResolvedValueOnce(row);
        expect(await resolveWebImpersonation(adminToken, c, at)).toBeNull();
      }
    });

    it("admin her yerden cikis yaptiysa (tokenVersion) gecmez", async () => {
      m.userFindUnique.mockResolvedValue(targetRow);
      expect(await resolveWebImpersonation({ ...adminToken, tv: 2 }, await cookieFor(), new Date(T0.getTime() + 1000))).toBeNull();
    });

    it("sahte imza ya da baska aile token'i gecmez", async () => {
      const c = await cookieFor();
      const tampered = c.slice(0, -2) + (c.endsWith("A") ? "BB" : "AA");
      expect(await verifyWebImpersonation(tampered, { now: T0 })).toBeNull();
      process.env.AUTH_SECRET = "another-secret-entirely-0123456789abcdef";
      expect(await verifyWebImpersonation(c, { now: T0 })).toBeNull();
    });
  });

  describe("durdurma", () => {
    function req(cookie?: string) {
      return {
        cookies: { get: (n: string) => (cookie && n === WEB_IMPERSONATION_COOKIE ? { value: cookie } : undefined) },
        headers: new Headers(),
      } as unknown as Parameters<typeof stopRoute>[0];
    }

    it("cerezi siler ve bitis kaydini adminin adina yazar", async () => {
      const live = await signWebImpersonation({ targetId: TARGET, targetTv: 3, adminId: ADMIN, adminTv: 1 });
      const res = await stopRoute(req(live!.token));
      expect(res.status).toBe(200);
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain(`${WEB_IMPERSONATION_COOKIE}=;`);
      expect(m.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: ADMIN,
          action: "admin.impersonate.stop",
          entityType: "User",
          entityId: TARGET,
        }),
      );
    });

    it("durduktan sonra (cerez yok) oturum adminin kendisi", async () => {
      expect(await resolveWebImpersonation(adminToken, undefined)).toBeNull();
      expect(m.userFindUnique).not.toHaveBeenCalled();
    });

    it("gecersiz cerezde de cerezi siler ama denetim kaydi yazmaz", async () => {
      const res = await stopRoute(req("not-a-token"));
      expect(res.status).toBe(200);
      expect(m.audit).not.toHaveBeenCalled();
    });
  });

  describe("salt okunur", () => {
    const base = { valid: true, isAdminPath: false };
    it("yazma istekleri (server action dahil) kesilir, durdurma ve cikis acik", () => {
      expect(impersonationProxyDecision({ ...base, method: "POST", pathname: "/tr/account" })).toBe("block");
      expect(impersonationProxyDecision({ ...base, method: "DELETE", pathname: "/api/x" })).toBe("block");
      expect(impersonationProxyDecision({ ...base, method: "POST", pathname: "/api/impersonation/stop" })).toBe("pass");
      expect(impersonationProxyDecision({ ...base, method: "POST", pathname: "/api/auth/signout" })).toBe("pass");
    });

    it("okuma gecer; veri disa aktarimi kapali; yonetici paneli ana sayfaya", () => {
      expect(impersonationProxyDecision({ ...base, method: "GET", pathname: "/tr/bookings" })).toBe("pass");
      expect(impersonationProxyDecision({ ...base, method: "GET", pathname: "/api/account/data-export" })).toBe("block");
      expect(impersonationProxyDecision({ valid: true, isAdminPath: true, method: "GET", pathname: "/tr/admin" })).toBe(
        "redirect_home",
      );
    });

    it("gecersiz cerez temizlenir, istek normal akar", () => {
      expect(impersonationProxyDecision({ valid: false, isAdminPath: false, method: "POST", pathname: "/tr" })).toBe(
        "clear_cookie",
      );
    });

    it("action kapisi goruntuleme oturumunu reddeder", async () => {
      m.auth.mockResolvedValue({
        user: { id: TARGET, role: "GUEST" },
        impersonation: { adminId: ADMIN, expiresAt: T0.toISOString() },
      });
      expect((await requireUser()).ok).toBe(false);
    });
  });
});
