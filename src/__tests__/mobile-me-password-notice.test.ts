import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSet, mockMail, mockAuth } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockMail: vi.fn(),
  mockAuth: vi.fn(),
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: mockAuth,
  signAccessToken: vi.fn(async () => "a"),
  signRefreshToken: vi.fn(async () => "r"),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/services/auth/set-own-password", () => ({ setOwnPassword: mockSet }));
vi.mock("@/lib/mail", () => ({ sendPasswordSetNotice: mockMail }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { POST } from "@/app/api/mobile/auth/me/password/route";

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

  it("sifresiz hesapta sifre konunca sahibine dilinde e-posta gider", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "a@b.co" } });
    mockSet.mockResolvedValue({ ok: true, tokenVersion: 0, rotated: false });
    const res = await POST(req());
    expect(res?.status).toBe(200);
    expect(mockMail).toHaveBeenCalledWith("a@b.co", "de");
  });

  it("degisimde (rotated) ve goruntuleme oturumunda e-posta gitmez", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "a@b.co" } });
    mockSet.mockResolvedValue({ ok: true, tokenVersion: 1, rotated: true });
    await POST(req());
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "a@b.co", impersonatedBy: "adm" } });
    mockSet.mockResolvedValue({ ok: true, tokenVersion: 0, rotated: false });
    await POST(req());
    expect(mockMail).not.toHaveBeenCalled();
  });

  it("e-posta gonderimi patlasa da yanit 200 doner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST", email: "a@b.co" } });
    mockSet.mockResolvedValue({ ok: true, tokenVersion: 0, rotated: false });
    mockMail.mockRejectedValue(new Error("boom"));
    expect((await POST(req()))?.status).toBe(200);
  });
});
