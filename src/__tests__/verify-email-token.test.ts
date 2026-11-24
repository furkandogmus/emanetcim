import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `verifyEmailToken` kahin olmamali: `VerificationToken` baska akislarin
 * (sifirlama, eski mobil kod) satirlarini da tutar. Yalnizca ham e-posta
 * kimlikli satir kabul edilir; bulunamayan / suresi dolan / hesapsiz tek kod.
 */
const { mockPrisma, link } = vi.hoisted(() => ({
  mockPrisma: {
    verificationToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
  link: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/booking/guest-link", () => ({ linkGuestBookingsToVerifiedUser: link }));

import { verifyEmailToken } from "@/services/auth/verify-email";

const future = () => new Date(Date.now() + 60_000);

beforeEach(() => vi.clearAllMocks());

describe("verifyEmailToken", () => {
  it("baska akisin satiri (mobile:, password-reset:) hesap aranmadan ayni hatayi verir", async () => {
    for (const identifier of ["mobile:guest@example.com", "password-reset:guest@example.com", "password-reset:phone:5550000000"]) {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({ identifier, token: "123456", expires: future() });
      expect(await verifyEmailToken("123456")).toEqual({ ok: false, code: "INVALID_TOKEN" });
    }
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("bulunamayan, suresi dolan ve hesapsiz token ayirt edilemez", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);
    const missing = await verifyEmailToken("t1");
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "guest@example.com",
      token: "t2",
      expires: new Date(Date.now() - 1000),
    });
    const expired = await verifyEmailToken("t2");
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({ identifier: "guest@example.com", token: "t3", expires: future() });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const noUser = await verifyEmailToken("t3");
    expect(missing).toEqual({ ok: false, code: "INVALID_TOKEN" });
    expect(expired).toEqual(missing);
    expect(noUser).toEqual(missing);
  });

  it("gecerli e-posta token'i hesabi dogrular", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({ identifier: "guest@example.com", token: "t4", expires: future() });
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    expect(await verifyEmailToken("t4")).toEqual({ ok: true, email: "guest@example.com" });
    expect(link).toHaveBeenCalledWith("u1");
  });
});
