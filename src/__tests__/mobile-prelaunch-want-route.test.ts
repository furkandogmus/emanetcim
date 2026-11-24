import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/** `POST /api/mobile/prelaunch/want`: kimlik, hiz siniri, haber verme kaydi. */
const { mockRegister, mockRecord, mockRateLimit, mockAuth } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockRecord: vi.fn(),
  mockRateLimit: vi.fn(),
  mockAuth: vi.fn(),
}));
vi.mock("@/services/PrelaunchInterestService", () => ({
  prelaunchInterestService: { registerWant: mockRegister, record: mockRecord },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: async () => "1.1.1.1" }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockAuth,
}));

import { POST as route } from "@/app/api/mobile/prelaunch/want/route";

const POST = async (r: NextRequest) => (await route(r))!;

const SHOP = "11111111-1111-4111-8111-111111111111";
const DEVICE = "22222222-2222-4222-8222-222222222222";

const req = (body: unknown, token = false) =>
  new NextRequest("https://bagajpark.com/api/mobile/prelaunch/want", {
    method: "POST",
    body: JSON.stringify(body),
    headers: token ? { authorization: "Bearer t" } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue(true);
  mockRegister.mockResolvedValue({ ok: true, alreadyCounted: false, count: 4 });
  mockRecord.mockResolvedValue({ ok: true, alreadyRegistered: false });
  mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "guest@example.test" } });
});

describe("POST /api/mobile/prelaunch/want", () => {
  it("girissiz: cihaz kimligiyle sayilir, haber verme kaydi yazilmaz", async () => {
    const res = await POST(req({ shopId: SHOP, deviceId: DEVICE, notify: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 4, alreadyCounted: false, subscribed: null });
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ anonId: `device:${DEVICE}`, source: "mobile" }));
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("girisli: hesap kimligi + hesap e-postasina haber verme kaydi", async () => {
    const res = await POST(req({ shopId: SHOP, deviceId: DEVICE, notify: true }, true));
    expect((await res.json()).subscribed).toBe("new");
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ anonId: "user:u1" }));
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ email: "guest@example.test", source: "mobile" }));
  });

  it("kimlik yoksa 400, gecersiz govde 400", async () => {
    expect((await POST(req({ shopId: SHOP }))).status).toBe(400);
    expect((await POST(req({ shopId: "x", deviceId: DEVICE }))).status).toBe(400);
  });

  it("reddedilen token anonime dusmez: 401", async () => {
    mockAuth.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    expect((await POST(req({ shopId: SHOP, deviceId: DEVICE }, true))).status).toBe(401);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("goruntuleme oturumunda yazilmaz", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "g@example.test", impersonatedBy: "a1" } });
    expect((await POST(req({ shopId: SHOP }, true))).status).toBe(403);
  });

  it("hiz siniri 429", async () => {
    mockRateLimit.mockResolvedValue(false);
    expect((await POST(req({ shopId: SHOP, deviceId: DEVICE }))).status).toBe(429);
  });

  it("nokta acildiysa 409 shop_now_open", async () => {
    mockRegister.mockResolvedValue({ ok: false, code: "shop_not_prelaunch" });
    const res = await POST(req({ shopId: SHOP, deviceId: DEVICE }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("shop_now_open");
  });
});
