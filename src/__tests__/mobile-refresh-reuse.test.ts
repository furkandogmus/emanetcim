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

vi.mock("@/lib/mobile-auth", async (orig) => {
  const real = await orig<typeof import("@/lib/mobile-auth")>();
  return {
    unauthorized: real.unauthorized,
    serviceUnavailable: real.serviceUnavailable,
    verifyMobileToken: vi.fn(),
    signAccessToken: vi.fn().mockResolvedValue("new-access"),
    signRefreshToken: vi.fn().mockResolvedValue("new-refresh"),
  };
});

vi.mock("@/lib/refresh-token-store", () => ({
  claimRefreshJti: vi.fn(),
  rememberIssuedPair: vi.fn().mockResolvedValue(undefined),
  releaseRefreshJti: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/db";
import { signRefreshToken, verifyMobileToken } from "@/lib/mobile-auth";
import { claimRefreshJti, rememberIssuedPair, releaseRefreshJti } from "@/lib/refresh-token-store";
import { rateLimit } from "@/lib/rate-limit";
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
    vi.mocked(claimRefreshJti).mockResolvedValue({ kind: "first" });
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(revokeAllUserSessions).not.toHaveBeenCalled();
    // Halefin jti'si ciftin yanina yazilir: halef kullanildiktan sonraki tekrar replay sayilir.
    const nextJti = vi.mocked(signRefreshToken).mock.calls[0][3];
    expect(typeof nextJti).toBe("string");
    expect(rememberIssuedPair).toHaveBeenCalledWith(
      "jti-1",
      { accessToken: "new-access", refreshToken: "new-refresh" },
      nextJti,
    );
  });

  it("tolerans penceresinde tekrar: aynı çift döner, aile iptal edilmez", async () => {
    const pair = { accessToken: "a-1", refreshToken: "r-1" };
    vi.mocked(claimRefreshJti).mockResolvedValue({ kind: "repeat", pair });
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(pair);
    expect(revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("ilk istek henüz bitmemişken tekrar: 503, aile iptal edilmez", async () => {
    vi.mocked(claimRefreshJti).mockResolvedValue({ kind: "pending" });
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect(revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("veritabanı hatası 401 değil 503 döner (istemci oturumu korur)", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("pool timeout"));
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("service_unavailable");
  });

  it("Redis hatası (jti deposu ya da hız sınırı) 503 döner", async () => {
    vi.mocked(claimRefreshJti).mockRejectedValue(new Error("redis down"));
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    expect((await POST(makeRequest())).status).toBe(503);
    vi.mocked(rateLimit).mockRejectedValueOnce(new Error("redis down"));
    expect((await POST(makeRequest())).status).toBe(503);
  });

  it("geçersiz token 401 kalır", async () => {
    vi.mocked(verifyMobileToken).mockRejectedValue(new Error("bad signature"));
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");
    expect((await POST(makeRequest())).status).toBe(401);
  });

  it("pencere dışında tekrar (replay) 401 döner VE tüm aile (tokenVersion) iptal edilir", async () => {
    vi.mocked(claimRefreshJti).mockResolvedValue({ kind: "reused" });
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
