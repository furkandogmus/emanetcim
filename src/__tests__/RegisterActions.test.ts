import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGuestAction, registerPartnerApplicationAction } from "../actions/register";

const { mockPrisma, mockRateLimit, mockMail } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      shop: {
        create: vi.fn(),
      },
      analyticsEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn((fn) => fn(mockPrisma)),
    },
    mockRateLimit: vi.fn().mockResolvedValue(true),
    mockMail: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: mockMail }));
vi.mock("@/lib/tokens", () => ({
  generateVerificationToken: vi.fn().mockResolvedValue({ token: "token123" }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("tr"),
}));
vi.mock("@/lib/auth-password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_pass"),
}));
vi.mock("@/lib/disposable-emails", () => ({
  isDisposableEmail: vi.fn((email) => email.includes("tempmail.com")),
}));

describe("Register Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(true);
  });

  describe("registerGuestAction", () => {
    it("should return error for invalid email", async () => {
      const result = await registerGuestAction({
        email: "invalid-email",
        name: "Test",
        password: "password123",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.invalidData");
    });

    it("should block disposable emails", async () => {
      const result = await registerGuestAction({
        email: "test@tempmail.com",
        name: "Test",
        password: "password123",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.invalidEmail");
    });

    it("should block if email already exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "1" });
      const result = await registerGuestAction({
        email: "exists@test.com",
        name: "Test",
        password: "password123",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.emailAlreadyRegistered");
    });

    it("should create user and send verification email on success", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: "new-uid", email: "new@test.com" });

      const result = await registerGuestAction({
        email: "new@test.com",
        name: "New User",
        password: "password123",
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockMail).toHaveBeenCalled();
    });

    it("should enforce rate limiting", async () => {
      mockRateLimit.mockResolvedValue(false);
      const result = await registerGuestAction({
        email: "rate@limit.com",
        name: "Test",
        password: "password123",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.tooManyRequests");
    });
  });

  describe("registerPartnerApplicationAction", () => {
    it("should return error for invalid phone format", async () => {
      const result = await registerPartnerApplicationAction({
        name: "Partner",
        phone: "123", // invalid TR phone regex
        password: "password123",
        shopName: "Shop",
        shopAddress: "Address",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.invalidData");
    });

    it("should normalize and check duplicate phone", async () => {
      // Input: 0555 555 55 55 (matches regex in register.ts)
      // Normalized: 5555555555
      mockPrisma.user.findUnique.mockResolvedValue({ id: "existing-phone" });

      const result = await registerPartnerApplicationAction({
        name: "Partner",
        phone: "0555 555 55 55",
        password: "password123",
        shopName: "Shop",
        shopAddress: "Address",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.phoneAlreadyRegistered");
    });

    it("should create user and shop in a transaction", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      const result = await registerPartnerApplicationAction({
        name: "New Partner",
        phone: "0555 555 55 55",
        password: "password123",
        shopName: "Excellent Shop",
        shopAddress: "Besiktas, Istanbul",
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.shop.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: "Excellent Shop",
        })
      }));
    });

    it("attributes a partner-to-partner referral when the code belongs to a PARTNER", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // phone-exists check
        .mockResolvedValueOnce({ id: "referrer-partner-id", role: "PARTNER" }); // referral lookup

      const result = await registerPartnerApplicationAction({
        name: "New Partner",
        phone: "0555 555 55 66",
        password: "password123",
        shopName: "Referred Shop",
        shopAddress: "Kadikoy, Istanbul",
        referredByCode: "abc123",
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.user.findUnique).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { referralCode: "ABC123" } }),
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ referredByPartnerId: "referrer-partner-id" }),
        }),
      );
    });

    it("ignores a referral code that belongs to a non-PARTNER user", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // phone-exists check
        .mockResolvedValueOnce({ id: "some-guest-id", role: "GUEST" }); // referral lookup

      await registerPartnerApplicationAction({
        name: "New Partner",
        phone: "0555 555 55 77",
        password: "password123",
        shopName: "Another Shop",
        shopAddress: "Sisli, Istanbul",
        referredByCode: "GUESTCODE",
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ referredByPartnerId: null }),
        }),
      );
    });
  });
});
