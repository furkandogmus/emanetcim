import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  default: { user: { findUnique: vi.fn(async () => ({ name: "Ada Ornek Soyad" })) } },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/internal-api-guard", () => ({ clientIp: () => "203.0.113.1" }));
vi.mock("@/lib/mobile-auth", () => ({ requireMobileUser: vi.fn(async () => ({ error: new Response(null, { status: 401 }) })) }));
vi.mock("@/services/ReferralService", () => ({
  referralService: { check: vi.fn(async () => ({ ok: true, code: "ABCD2345", discountPct: 10 })) },
}));

import { POST } from "@/app/api/mobile/referrals/validate/route";

describe("referrals/validate", () => {
  it("kimliksiz cagriya davet edenin yalnizca ilk adini doner", async () => {
    const req = new NextRequest("https://ornek.test/api/mobile/referrals/validate", {
      method: "POST",
      body: JSON.stringify({ code: "abcd2345" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toEqual({ valid: true, discountPct: 10, referrerName: "Ada" });
  });
});
