import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, rateLimit, signAccess, signRefresh, record } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    verificationToken: { delete: vi.fn() },
  },
  rateLimit: vi.fn(async (_key: string, _max: number, _windowMs: number) => true),
  signAccess: vi.fn(async () => "access"),
  signRefresh: vi.fn(async () => "refresh"),
  record: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/internal-api-guard", () => ({ clientIp: () => "203.0.113.7" }));
vi.mock("@/lib/mobile-auth", () => ({ signAccessToken: signAccess, signRefreshToken: signRefresh }));
vi.mock("@/lib/mobile-dto", () => ({ toMobileUser: (u: { id: string }) => ({ id: u.id }) }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: { notifyAdminsForNewUser: vi.fn(async () => undefined) },
}));
vi.mock("@/services/AnalyticsService", () => ({ analyticsService: { track: vi.fn() } }));
vi.mock("@/lib/analytics-server", () => ({ resolveServerSessionId: vi.fn(async () => "s") }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/auth/verify-email", () => ({ markEmailVerifiedByCode: vi.fn() }));
vi.mock("@/services/auth/legal-acceptance", () => ({ recordMobileLegalAcceptance: record }));
vi.mock("@/lib/auth-password", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth-password")>()),
  verifyPassword: vi.fn(async () => false),
}));

import { POST } from "@/app/api/mobile/auth/session/route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/mobile/auth/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockResolvedValue(true);
  });

  it("telefonla kod dogrulamasi SMS yokken sms_unavailable doner", async () => {
    const res = await POST(req({ phone: "5321234567", code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("sms_unavailable");
    expect(mockPrisma.verificationToken.delete).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("sifre kovasi kimlik + IP ile anahtarlanir ve yalniz-kimlik yedegi vardir", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await POST(req({ phone: "5321234567", password: "x" }));
    const keys = rateLimit.mock.calls.map((c) => c[0] as string);
    expect(keys).toContain("mobile_pwd:5321234567:203.0.113.7");
    expect(keys).toContain("mobile_pwd:5321234567");
    const idOnly = rateLimit.mock.calls.find((c) => c[0] === "mobile_pwd:5321234567");
    expect(idOnly?.[1]).toBeGreaterThan(5);
  });

  it("yanlis sifre iki durumda da ayni invalid_credentials kodunu doner (hesap var/yok sizmaz)", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);
    const none = await POST(req({ phone: "5321234567", password: "x" }));
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "u1", passwordHash: null });
    const noPassword = await POST(req({ phone: "5321234567", password: "x" }));
    expect(none.status).toBe(401);
    expect((await none.json()).error).toBe("invalid_credentials");
    expect(noPassword.status).toBe(401);
    expect((await noPassword.json()).error).toBe("invalid_credentials");
  });

  it("bot kalibi yeni e-postada kodu tuketmeden 403 doner", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(req({ email: "x@mailinator.com", code: "123456" }));
    expect(res.status).toBe(403);
    expect(mockPrisma.verificationToken.delete).not.toHaveBeenCalled();
  });

  it("yeni e-posta hesabi adsiz acilir ve acceptedLegal ile kabul kaydi yazilir", async () => {
    mockPrisma.verificationToken.delete.mockResolvedValue({ expires: new Date(Date.now() + 60_000) });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "u2",
      role: "GUEST",
      name: null,
      email: "gast@example.com",
      phone: null,
      emailVerified: new Date(),
      tokenVersion: 0,
      isBanned: false,
    });
    const res = await POST(req({ email: "gast@example.com", code: "123456", acceptedLegal: true }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.create.mock.calls[0][0].data.name).toBeNull();
    expect(record).toHaveBeenCalledWith("u2", "203.0.113.7");
  });

  it("acceptedLegal gelmezse (eski surum) kabul kaydi yazilmaz", async () => {
    mockPrisma.verificationToken.delete.mockResolvedValue({ expires: new Date(Date.now() + 60_000) });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "u3",
      role: "GUEST",
      name: null,
      email: "gast2@example.com",
      phone: null,
      emailVerified: new Date(),
      tokenVersion: 0,
      isBanned: false,
    });
    await POST(req({ email: "gast2@example.com", code: "123456" }));
    expect(record).not.toHaveBeenCalled();
  });
});
