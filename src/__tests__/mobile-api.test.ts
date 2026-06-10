import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  default: {
    verificationToken: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    shop: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/netgsm", () => ({
  isNetgsmConfigured: vi.fn().mockReturnValue(false),
  normalizeTrGsm10: vi.fn((v: string) => v?.replace(/\D/g, "") ?? null),
  sendNetgsmRestSms: vi.fn(),
}));

vi.mock("@/lib/mail", () => ({
  sendMobileOtp: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/services/ShopService", () => ({
  ShopService: class {
    findNearby = vi.fn().mockResolvedValue([]);
  },
}));

import prisma from "@/lib/db";
import { isNetgsmConfigured } from "@/lib/netgsm";
import { sendMobileOtp } from "@/lib/mail";

describe("Mobile API - Auth OTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject invalid input", async () => {
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_input");
  });

  it("should reject invalid phone format", async () => {
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({ phone: "123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should send OTP via email for email identity", async () => {
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@bagajpark.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(sendMobileOtp).toHaveBeenCalled();
    expect(prisma.verificationToken.upsert).toHaveBeenCalled();
  });

  it("should skip SMS when netgsm not configured for phone identity", async () => {
    vi.mocked(isNetgsmConfigured).mockReturnValue(false);
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({ phone: "5051234567" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("Mobile API - Shops Nearby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject missing coordinates", async () => {
    const { GET } = await import("@/app/api/mobile/shops/nearby/route");
    const req = new NextRequest("http://localhost/api/mobile/shops/nearby");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("should return shops for valid coordinates", async () => {
    const { GET } = await import("@/app/api/mobile/shops/nearby/route");
    const req = new NextRequest("http://localhost/api/mobile/shops/nearby?lat=41.0&lng=29.0&r=1000");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
