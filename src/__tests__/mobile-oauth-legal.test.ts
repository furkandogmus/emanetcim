import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, record, verify } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    account: { findFirst: vi.fn(), create: vi.fn() },
  },
  record: vi.fn(async () => undefined),
  verify: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("jose", () => ({ createRemoteJWKSet: () => ({}), jwtVerify: verify }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/internal-api-guard", () => ({ clientIp: () => "203.0.113.7" }));
vi.mock("@/lib/mobile-auth", () => ({
  signAccessToken: vi.fn(async () => "access"),
  signRefreshToken: vi.fn(async () => "refresh"),
}));
vi.mock("@/lib/mobile-dto", () => ({ toMobileUser: (u: { id: string }) => ({ id: u.id }) }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: { notifyAdminsForNewUser: vi.fn(async () => undefined) },
}));
vi.mock("@/services/AnalyticsService", () => ({ analyticsService: { track: vi.fn() } }));
vi.mock("@/lib/analytics-server", () => ({ resolveServerSessionId: vi.fn(async () => "s") }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/auth/legal-acceptance", () => ({ recordMobileLegalAcceptance: record }));
// Sifre dusurme adimi hata verirse giris de duser (2026-11-28); burada olculen o degil.
vi.mock("@/services/auth/verify-email", () => ({
  markEmailVerifiedByLogin: vi.fn(async () => ({ passwordDropped: false })),
}));

import { POST as google } from "@/app/api/mobile/auth/google/route";
import { POST as apple } from "@/app/api/mobile/auth/apple/route";

function req(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/mobile/auth/${path}`, { method: "POST", body: JSON.stringify(body) });
}

describe("Google/Apple ile acilan hesapta yasal kabul", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "web-client";
    process.env.APPLE_BUNDLE_ID = "com.example.app";
    mockPrisma.account.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "u-new", role: "GUEST", tokenVersion: 0, isBanned: false });
    mockPrisma.user.upsert.mockResolvedValue({ id: "u-new", role: "GUEST", tokenVersion: 0, isBanned: false });
  });

  it("google: yeni hesap + acceptedLegal kabul kaydi yazar", async () => {
    verify.mockResolvedValue({ payload: { email: "new@example.com", email_verified: true } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await google(req("google", { idToken: "t", acceptedLegal: true }));
    expect(res.status).toBe(200);
    expect(record).toHaveBeenCalledWith("u-new", "203.0.113.7");
  });

  it("google: acceptedLegal yoksa (eski surum) ya da hesap zaten varsa yazmaz", async () => {
    verify.mockResolvedValue({ payload: { email: "new@example.com", email_verified: true } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await google(req("google", { idToken: "t" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u-old", role: "GUEST", tokenVersion: 0, isBanned: false });
    await google(req("google", { idToken: "t", acceptedLegal: true }));
    expect(record).not.toHaveBeenCalled();
  });

  it("apple: yeni hesap + acceptedLegal kabul kaydi yazar, mevcut e-postaya baglanmada yazmaz", async () => {
    verify.mockResolvedValue({ payload: { sub: "s1", email: "new@example.com", email_verified: "true" } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await apple(req("apple", { identityToken: "t", acceptedLegal: true }));
    expect(res.status).toBe(200);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith("u-new", "203.0.113.7");

    record.mockClear();
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u-old" });
    await apple(req("apple", { identityToken: "t", acceptedLegal: true }));
    expect(record).not.toHaveBeenCalled();
  });
});
