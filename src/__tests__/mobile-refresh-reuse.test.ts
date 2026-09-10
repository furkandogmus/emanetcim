import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * `/api/mobile/auth/refresh` replay tespiti — 2026-09-10'da bulundu: ayni
 * refresh token ikinci kez sunuldugunda tum aile (`tokenVersion`) iptal
 * edilmeli, yoksa calinmis bir token sinirsizca yeni cift uretebiliyordu.
 */

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
  getRedis: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/db", () => ({
  default: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/auth/mobile-session", () => ({
  revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mobile-auth", () => ({
  verifyMobileToken: vi.fn(),
  signAccessToken: vi.fn().mockResolvedValue("new-access"),
  signRefreshToken: vi.fn().mockResolvedValue("new-refresh"),
}));

vi.mock("@/lib/refresh-token-store", () => ({
  claimRefreshJti: vi.fn(),
}));

import prisma from "@/lib/db";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { claimRefreshJti } from "@/lib/refresh-token-store";
import { revokeAllUserSessions } from "@/services/auth/mobile-session";

function makeRequest() {
  return new NextRequest("http://localhost/api/mobile/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: "rt-token" }),
  });
}

describe("POST /api/mobile/auth/refresh — replay tespiti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      role: "GUEST",
      isBanned: false,
      tokenVersion: 3,
    } as never);
    vi.mocked(verifyMobileToken).mockResolvedValue({
      sub: "u1",
      role: "GUEST",
      type: "refresh",
      tv: 3,
      jti: "jti-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    } as never);
  });

  it("ilk kullanımda yeni token çifti döner", async () => {
    vi.mocked(claimRefreshJti).mockResolvedValue(true);
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("replay tespit edilirse 401 döner VE tüm aile (tokenVersion) iptal edilir", async () => {
    vi.mocked(claimRefreshJti).mockResolvedValue(false);
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(revokeAllUserSessions).toHaveBeenCalledWith("u1");
  });

  it("jti taşımayan eski token için replay kontrolü atlanır (geçiş dönemi)", async () => {
    vi.mocked(verifyMobileToken).mockResolvedValue({
      sub: "u1",
      role: "GUEST",
      type: "refresh",
      tv: 3,
      exp: Math.floor(Date.now() / 1000) + 3600,
    } as never);
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(claimRefreshJti).not.toHaveBeenCalled();
  });
});
