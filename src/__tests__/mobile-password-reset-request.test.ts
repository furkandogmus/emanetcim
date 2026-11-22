import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, sendMail } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() }, passwordResetCode: { upsert: vi.fn() } },
  sendMail: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.stubEnv("AUTH_SECRET", "test-secret");
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/client-ip", () => ({ clientIpFromRequest: () => "203.0.113.7" }));
vi.mock("@/lib/mail", () => ({ sendPasswordResetEmail: sendMail }));
vi.mock("@/lib/password-reset-token", () => ({ generatePasswordResetToken: vi.fn(async () => ({ token: "tok" })) }));

import { POST } from "@/app/api/mobile/auth/password-reset/request/route";

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/mobile/auth/password-reset/request", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("password-reset/request dil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "gast@example.com" });
  });

  it("istemcinin gonderdigi Almanca dil e-postaya gecer", async () => {
    await POST(req({ email: "gast@example.com", locale: "de" }));
    expect(sendMail).toHaveBeenCalledWith("gast@example.com", "tok", "de", expect.stringMatching(/^\d{6}$/));
  });

  it("dil yoksa Accept-Language'e duser", async () => {
    await POST(req({ email: "gast@example.com" }, { "accept-language": "de-DE,de;q=0.9" }));
    expect(sendMail).toHaveBeenCalledWith("gast@example.com", "tok", "de", expect.stringMatching(/^\d{6}$/));
  });

  it("taninmayan dil istegi dusurmez, Accept-Language'e duser", async () => {
    await POST(req({ email: "gast@example.com", locale: "ru" }, { "accept-language": "en" }));
    expect(sendMail).toHaveBeenCalledWith("gast@example.com", "tok", "en", expect.stringMatching(/^\d{6}$/));
  });
});
