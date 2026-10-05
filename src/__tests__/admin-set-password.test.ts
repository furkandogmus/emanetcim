import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/auth-password", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth-password")>()),
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
}));

import { adminSetUserPassword } from "@/services/auth/admin-set-password";

describe("adminSetUserPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "PARTNER", phone: "5455191039", name: "Esnaf" });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it("şifreyi hash'ler ve eski oturumları düşürür", async () => {
    const res = await adminSetUserPassword("u-1", "Yeni-sifre9");
    expect(res).toEqual({ ok: true, phone: "5455191039", name: "Esnaf" });
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u-1", role: { not: "ADMIN" } },
      data: { passwordHash: "hashed:Yeni-sifre9", tokenVersion: { increment: 1 } },
    });
  });

  it("kısa şifreyi reddeder", async () => {
    expect(await adminSetUserPassword("u-1", "kisa")).toEqual({ ok: false, reason: "invalid_password" });
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("admin hesabına uygulanmaz", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "ADMIN", phone: null, name: null });
    expect(await adminSetUserPassword("u-1", "Yeni-sifre9")).toEqual({ ok: false, reason: "forbidden_target" });
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });
});
