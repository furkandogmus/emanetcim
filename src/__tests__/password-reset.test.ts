import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestPasswordResetAction, resetPasswordWithTokenAction } from "../actions/password-reset";
import { PASSWORD_RESET_IDENTIFIER_PREFIX } from "../lib/password-reset-token";

const { mockPrisma, mockRateLimit, mockMail } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      verificationToken: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn((fn) => {
        if (typeof fn === 'function') return fn(mockPrisma);
        return Promise.all(fn);
      }),
    },
    mockRateLimit: vi.fn().mockResolvedValue(true),
    mockMail: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/mail", () => ({ 
  sendPasswordResetEmail: mockMail,
  sendVerificationEmail: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("tr"),
}));
vi.mock("@/lib/auth-password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_new_pass"),
}));

describe("Password Reset Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(true);
  });

  describe("requestPasswordResetAction", () => {
    it("should always return ok: true for privacy", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await requestPasswordResetAction("nonexistent@test.com");
      expect(result.ok).toBe(true);
      expect(mockMail).not.toHaveBeenCalled();
    });

    it("should send email if user exists and has password", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "user@test.com",
        passwordHash: "existing_hash",
      });
      mockPrisma.verificationToken.findFirst.mockResolvedValue(null);
      mockPrisma.verificationToken.create.mockResolvedValue({ token: "token123" });

      const result = await requestPasswordResetAction("user@test.com");
      
      expect(result.ok).toBe(true);
      expect(mockMail).toHaveBeenCalledWith("user@test.com", "token123", "tr");
    });

    it("should send email for OAuth users (no passwordHash)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "oauth123",
        email: "oauth@test.com",
        passwordHash: null,
      });
      mockPrisma.verificationToken.findFirst.mockResolvedValue(null);
      mockPrisma.verificationToken.create.mockResolvedValue({ token: "token123" });

      const result = await requestPasswordResetAction("oauth@test.com");
      
      expect(result.ok).toBe(true);
      expect(mockMail).toHaveBeenCalledWith("oauth@test.com", "token123", "tr");
    });

    it("should enforce rate limits", async () => {
      mockRateLimit.mockResolvedValue(false);
      const result = await requestPasswordResetAction("any@test.com");
      expect(result.ok).toBe(true); // Still returns true but blocks action internally
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("resetPasswordWithTokenAction", () => {
    const validToken = "550e8400-e29b-41d4-a716-446655440000";
    
    it("should update password on success", async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValue({
        token: validToken,
        identifier: `${PASSWORD_RESET_IDENTIFIER_PREFIX}user@test.com`,
        expires: new Date(Date.now() + 10000),
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        passwordHash: "old_hash",
      });

      const result = await resetPasswordWithTokenAction({
        token: validToken,
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      expect(result.ok).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "user123" },
        data: { passwordHash: "hashed_new_pass" },
      }));
      expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
        where: { token: validToken },
      });
    });

    it("should return error for expired token", async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValue({
        token: validToken,
        identifier: `${PASSWORD_RESET_IDENTIFIER_PREFIX}user@test.com`,
        expires: new Date(Date.now() - 10000),
      });
      mockPrisma.verificationToken.delete.mockResolvedValue({});

      const result = await resetPasswordWithTokenAction({
        token: validToken,
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("expired");
    });

    it("should return error for invalid token format or prefix", async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValue({
        token: "other-token",
        identifier: `other-prefix:user@test.com`,
        expires: new Date(Date.now() + 10000),
      });

      const result = await resetPasswordWithTokenAction({
        token: validToken,
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("invalid_token");
    });

    it("should return error for password mismatch", async () => {
      const result = await resetPasswordWithTokenAction({
        token: validToken,
        password: "newpassword123",
        confirmPassword: "differentpassword",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("invalid");
    });
  });
});
