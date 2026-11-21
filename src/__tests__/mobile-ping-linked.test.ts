import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * /ping 401 donmez (sayac kimseyi cikisa dusurmemeli); bu yuzden istemci suresi
 * dolmus token'la geldiyse bunu `linked: false`tan anlayip yeniler.
 */
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true), getRedis: () => null }));
vi.mock("@/services/MobileInstallService", () => ({
  mobileInstallService: { recordOpen: vi.fn().mockResolvedValue(undefined) },
}));
const auth = vi.hoisted(() => ({ requireMobileUser: vi.fn() }));
vi.mock("@/lib/mobile-auth", () => auth);

import { POST } from "@/app/api/mobile/ping/route";

function req(withAuth: boolean) {
  return new NextRequest("http://localhost/api/mobile/ping", {
    method: "POST",
    headers: withAuth ? { authorization: "Bearer x" } : {},
    body: JSON.stringify({ installId: crypto.randomUUID(), platform: "android" }),
  });
}

describe("POST /api/mobile/ping linked", () => {
  beforeEach(() => auth.requireMobileUser.mockReset());

  it("gecerli token: linked true", async () => {
    auth.requireMobileUser.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: null } });
    const res = await POST(req(true));
    expect(await res.json()).toEqual({ ok: true, linked: true });
  });

  it("suresi dolmus token: 200 ama linked false", async () => {
    auth.requireMobileUser.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    const res = await POST(req(true));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, linked: false });
  });
});
