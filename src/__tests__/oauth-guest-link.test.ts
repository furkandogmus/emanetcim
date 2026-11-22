import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * Google/Apple'in dogruladigi e-posta da hesapsiz rezervasyonlari baglar
 * (QA #178, madde 3). Apple yalnizca `email_verified` dogruysa.
 */
const { mockPrisma, verify, markProvider } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    account: { findFirst: vi.fn(), create: vi.fn() },
  },
  verify: vi.fn(),
  markProvider: vi.fn(async () => undefined),
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
vi.mock("@/services/auth/legal-acceptance", () => ({ recordMobileLegalAcceptance: vi.fn() }));
vi.mock("@/services/auth/verify-email", () => ({ markEmailVerifiedByProvider: markProvider }));

import { POST as google } from "@/app/api/mobile/auth/google/route";
import { POST as apple } from "@/app/api/mobile/auth/apple/route";

const req = (p: string, body: unknown) =>
  new NextRequest(`http://localhost/api/mobile/auth/${p}`, { method: "POST", body: JSON.stringify(body) });
const user = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  email: "ada@example.com",
  role: "GUEST",
  tokenVersion: 0,
  isBanned: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = "web-client";
  process.env.APPLE_BUNDLE_ID = "com.example.app";
});

describe("mobil Google", () => {
  it("dogrulanmis e-postayla giriste baglama calisir", async () => {
    verify.mockResolvedValue({ payload: { email: "ada@example.com", email_verified: true } });
    mockPrisma.user.findUnique.mockResolvedValue(user());
    expect((await google(req("google", { idToken: "t" }))).status).toBe(200);
    expect(markProvider).toHaveBeenCalledWith("u1");
  });

  it("dogrulanmamis Google e-postasi reddedilir, baglama yok", async () => {
    verify.mockResolvedValue({ payload: { email: "ada@example.com", email_verified: false } });
    expect((await google(req("google", { idToken: "t" }))).status).toBe(401);
    expect(markProvider).not.toHaveBeenCalled();
  });

  it("yasakli hesapta baglama yok", async () => {
    verify.mockResolvedValue({ payload: { email: "ada@example.com", email_verified: true } });
    mockPrisma.user.findUnique.mockResolvedValue(user({ isBanned: true }));
    expect((await google(req("google", { idToken: "t" }))).status).toBe(403);
    expect(markProvider).not.toHaveBeenCalled();
  });
});

describe("mobil Apple", () => {
  it("email_verified dogruysa baglama calisir", async () => {
    verify.mockResolvedValue({ payload: { sub: "s1", email: "ada@example.com", email_verified: "true" } });
    mockPrisma.account.findFirst.mockResolvedValue({ user: user() });
    expect((await apple(req("apple", { identityToken: "t" }))).status).toBe(200);
    expect(markProvider).toHaveBeenCalledWith("u1");
  });

  it("email_verified yoksa ya da yanlissa baglama YOK", async () => {
    for (const claim of [false, "false", undefined]) {
      verify.mockResolvedValue({ payload: { sub: "s1", email: "ada@example.com", email_verified: claim } });
      mockPrisma.account.findFirst.mockResolvedValue({ user: user() });
      expect((await apple(req("apple", { identityToken: "t" }))).status).toBe(200);
    }
    expect(markProvider).not.toHaveBeenCalled();
  });

  it("dogrulanmis ama BASKA hesabin e-postasi (sub ile bulunan hesap) baglamaz", async () => {
    verify.mockResolvedValue({ payload: { sub: "s1", email: "other@example.com", email_verified: true } });
    mockPrisma.account.findFirst.mockResolvedValue({ user: user() });
    await apple(req("apple", { identityToken: "t" }));
    expect(markProvider).not.toHaveBeenCalled();
  });
});

describe("web OAuth", () => {
  it("jwt callback yalnizca saglayici (credentials degil) dalinda baglar", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/auth.ts"), "utf8");
    const branch = src.slice(src.indexOf('if (account && account.provider !== "credentials") {'));
    const body = branch.slice(0, branch.indexOf("} else {"));
    expect(body).toMatch(/await linkGuestBookingsToVerifiedUser\(dbUser\.id\)/);
    expect(src.match(/linkGuestBookingsToVerifiedUser\(/g)).toHaveLength(1);
  });
});
