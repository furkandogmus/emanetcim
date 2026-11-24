import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  default: {
    verificationToken: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    mobileLoginCode: {
      upsert: vi.fn(),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(),
    },
    shop: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.stubEnv("AUTH_SECRET", "test-secret-for-login-codes");

// shops/nearby fiyat araligi icin platform kurallarini okur; testte veritabani yok.
vi.mock("@/lib/platform-settings", async () => {
  const { DEFAULT_PRICING_RULES } = await import("@/lib/pricing-rules");
  return { getPricingRules: vi.fn(async () => DEFAULT_PRICING_RULES) };
});

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

vi.mock("@/services/ShopService", () => {
  const findNearby = vi.fn().mockResolvedValue([]);
  const findShopsForSearch = vi.fn().mockResolvedValue([]);
  const getShopImages = vi.fn().mockResolvedValue([]);
  const getPublicShopById = vi.fn().mockResolvedValue(null);
  const shopService = { findNearby, findShopsForSearch, getShopImages, getPublicShopById };
  return {
    ShopService: class {
      findNearby = findNearby;
      getPublicShopById = getPublicShopById;
    },
    shopService,
  };
});

vi.mock("@/services/ReviewService", () => {
  const getShopReviews = vi.fn().mockResolvedValue([]);
  return { reviewService: { getShopReviews } };
});

import prisma from "@/lib/db";
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
    // Kod duz saklanmaz: satirda yalnizca HMAC var, gonderilen kod yok.
    const sent = vi.mocked(sendMobileOtp).mock.calls[0][1];
    const row = vi.mocked(prisma.mobileLoginCode.upsert).mock.calls[0][0];
    expect(row.where).toEqual({ identity: "test@bagajpark.com" });
    expect(row.create.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(sent);
    expect(prisma.verificationToken.upsert).not.toHaveBeenCalled();
  });

  it("Play inceleme hesabi (reviewSandbox) sabit kodu alir, e-posta gitmez", async () => {
    vi.stubEnv("PLAY_REVIEW_EMAIL", "Review@Example.com");
    vi.stubEnv("PLAY_REVIEW_OTP", "246810");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "r1", role: "GUEST", reviewSandbox: true } as never);
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const { hashScopedCode } = await import("@/lib/password-reset-code");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "review@example.com" }),
    });
    const res = await POST(req);
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "test-secret-for-login-codes");
    expect(res.status).toBe(200);
    expect(sendMobileOtp).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.mobileLoginCode.upsert).mock.calls[0][0].create.codeHash).toBe(
      hashScopedCode("mobile-login", "review@example.com", "246810"),
    );
  });

  it("inceleme e-postasi reviewSandbox degilse sabit kod verilmez, normal kod gider", async () => {
    vi.stubEnv("PLAY_REVIEW_EMAIL", "review@example.com");
    vi.stubEnv("PLAY_REVIEW_OTP", "246810");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "r1", role: "GUEST", reviewSandbox: false } as never);
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const res = await POST(
      new Request("http://localhost/api/mobile/auth/otp", { method: "POST", body: JSON.stringify({ email: "review@example.com" }) }),
    );
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "test-secret-for-login-codes");
    expect(res.status).toBe(200);
    expect(sendMobileOtp).toHaveBeenCalled();
    expect(vi.mocked(sendMobileOtp).mock.calls[0][1]).not.toBe("246810");
  });

  it("ADMIN hesabina kod gonderilmez; yanit ayni (200 ok), satir eslesmez hash tasir", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "a1", role: "ADMIN", reviewSandbox: false } as never);
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const res = await POST(
      new Request("http://localhost/api/mobile/auth/otp", { method: "POST", body: JSON.stringify({ email: "admin@example.com" }) }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendMobileOtp).not.toHaveBeenCalled();
    expect(prisma.mobileLoginCode.upsert).toHaveBeenCalled();
  });

  it("should ignore a malformed review code and send a normal OTP", async () => {
    vi.stubEnv("PLAY_REVIEW_EMAIL", "review2@example.com");
    vi.stubEnv("PLAY_REVIEW_OTP", "abc");
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "review2@example.com" }),
    });
    const res = await POST(req);
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "test-secret-for-login-codes");
    expect(res.status).toBe(200);
    expect(sendMobileOtp).toHaveBeenCalled();
  });

  it("telefon kimligine kod gondermez: sms_unavailable, kod saklanmaz", async () => {
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({ phone: "5051234567" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("sms_unavailable");
    expect(prisma.mobileLoginCode.upsert).not.toHaveBeenCalled();
  });

  it("giris kodu e-postasi Accept-Language dilinde gider", async () => {
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      headers: { "accept-language": "de-DE,de;q=0.9" },
      body: JSON.stringify({ email: "gast@bagajpark.com" }),
    });
    await POST(req);
    expect(sendMobileOtp).toHaveBeenCalledWith("gast@bagajpark.com", expect.any(String), "de");
  });

  it("bot kalibi yeni e-postayi mail gitmeden 403 invalid_email ile reddeder", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/mobile/auth/otp/route");
    const req = new Request("http://localhost/api/mobile/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: "x@mailinator.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("invalid_email");
    expect(sendMobileOtp).not.toHaveBeenCalled();
    expect(prisma.mobileLoginCode.upsert).not.toHaveBeenCalled();
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

/**
 * Ekran turuyla bulundu (2026-09-09, Android emulator): mobil istemci
 * `/shops/:id/reviews` cagiriyordu ama bu uc HIC yoktu -- her cagri 404
 * doner, dukkan detayinda yorumlar sessizce "henuz yorum yok" gosterirdi.
 */
describe("Mobile API - Shop Reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should 404 when shop is not public", async () => {
    const { shopService } = await import("@/services/ShopService");
    vi.mocked(shopService.getPublicShopById).mockResolvedValue(null);
    const { GET } = await import("@/app/api/mobile/shops/[id]/reviews/route");
    const res = await GET(new Request("http://localhost/api/mobile/shops/x/reviews"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("should return mapped reviews (first-name-only author label)", async () => {
    const { shopService } = await import("@/services/ShopService");
    const { reviewService } = await import("@/services/ReviewService");
    vi.mocked(shopService.getPublicShopById).mockResolvedValue({ id: "shop-1" } as never);
    vi.mocked(reviewService.getShopReviews).mockResolvedValue([
      {
        id: "r1",
        rating: 5,
        comment: "harika",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        guest: { name: "Ada Lovelace" },
      },
    ] as never);
    const { GET } = await import("@/app/api/mobile/shops/[id]/reviews/route");
    const res = await GET(new Request("http://localhost/api/mobile/shops/shop-1/reviews"), {
      params: Promise.resolve({ id: "shop-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        id: "r1",
        rating: 5,
        comment: "harika",
        createdAt: "2026-01-01T00:00:00.000Z",
        authorLabel: "Ada",
      },
    ]);
  });
});
