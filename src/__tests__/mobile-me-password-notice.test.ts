import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSet, mockMail, mockAuth } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockMail: vi.fn(),
  mockAuth: vi.fn(),
}));

vi.mock("@/lib/mobile-auth", async (orig) => ({
  forbidWhileImpersonating: (await orig<typeof import("@/lib/mobile-auth")>()).forbidWhileImpersonating,
  requireMobileUser: mockAuth,
  signAccessToken: vi.fn(async () => "a"),
  signRefreshToken: vi.fn(async () => "r"),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/services/auth/set-own-password", () => ({ setOwnPassword: mockSet }));
vi.mock("@/lib/mail", () => ({ sendPasswordSetNotice: mockMail }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { POST as rawPost } from "@/app/api/mobile/auth/me/password/route";

const POST = async (r: never) => (await rawPost(r))!;

function req() {
  return new Request("http://x/api/mobile/auth/me/password", {
    method: "POST",
    headers: { "content-type": "application/json", "accept-language": "de" },
    body: JSON.stringify({ newPassword: "Yeni-sifre9" }),
  }) as never;
}

describe("POST /api/mobile/auth/me/password bildirimi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMail.mockResolvedValue(undefined);
  });

  it("ilk sifrede sahibine dilinde e-posta gider ve yeni token cifti doner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "a@b.co" } });
    mockSet.mockResolvedValue({ ok: true, tokenVersion: 1, firstPassword: true });
    const res = await POST(req());
    expect(res?.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, accessToken: "a", refreshToken: "r" });
    expect(mockMail).toHaveBeenCalledWith("a@b.co", "de");
  });

  it("degisimde e-posta gitmez ama token cifti doner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "a@b.co" } });
    mockSet.mockResolvedValue({ ok: true, tokenVersion: 2, firstPassword: false });
    const res = await POST(req());
    expect((await res.json()).accessToken).toBe("a");
    expect(mockMail).not.toHaveBeenCalled();
  });

  it("goruntuleme oturumunda 403, sifre yazilmaz", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "PARTNER", email: "a@b.co", impersonatedBy: "adm" } });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_allowed_while_impersonating");
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockMail).not.toHaveBeenCalled();
  });

  it("e-posta gonderimi patlasa da yanit 200 doner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "a@b.co" } });
    mockSet.mockResolvedValue({ ok: true, tokenVersion: 1, firstPassword: true });
    mockMail.mockRejectedValue(new Error("boom"));
    expect((await POST(req()))?.status).toBe(200);
  });
});
