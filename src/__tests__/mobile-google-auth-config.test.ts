import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Google ID token'i yalnizca TANIMLI istemci kimlikleri icin kabul edilir.
 * Kabul listesi bos kalinca jose `audience` kontrolunu atliyordu: herhangi bir
 * uygulamanin Google token'i hesap acabilirdi.
 */
const { mockJwtVerify } = vi.hoisted(() => ({ mockJwtVerify: vi.fn() }));
vi.mock("jose", async (orig) => ({
  ...(await orig<typeof import("jose")>()),
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: mockJwtVerify,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/db", () => ({ default: { user: { findUnique: vi.fn(), create: vi.fn() } } }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));
vi.mock("@/services/AnalyticsService", () => ({ analyticsService: { track: vi.fn() } }));
vi.mock("@/lib/analytics-server", () => ({ resolveServerSessionId: vi.fn() }));

import { POST } from "@/app/api/mobile/auth/google/route";

const KEYS = ["GOOGLE_IOS_CLIENT_ID", "GOOGLE_ANDROID_CLIENT_ID", "GOOGLE_CLIENT_ID"] as const;
const saved: Record<string, string | undefined> = {};

function req() {
  return new NextRequest("https://bagajpark.com/api/mobile/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken: "t" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  mockJwtVerify.mockRejectedValue(new Error("bad"));
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("mobil Google girisi istemci kimligi kapisi", () => {
  it("hicbir istemci kimligi yoksa 503 ve token dogrulanmaz", async () => {
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "google_not_configured" });
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("tanimli kimlik audience olarak zorunlu tutulur", async () => {
    process.env.GOOGLE_CLIENT_ID = "web-client.apps.googleusercontent.com";
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(mockJwtVerify).toHaveBeenCalledWith(
      "t",
      expect.anything(),
      expect.objectContaining({ audience: ["web-client.apps.googleusercontent.com"] }),
    );
  });
});
