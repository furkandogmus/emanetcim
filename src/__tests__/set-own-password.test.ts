import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/auth-password", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth-password")>()),
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async (p: string, h: string) => h === `hashed:${p}`),
}));

import { setOwnPassword } from "@/services/auth/set-own-password";

describe("setOwnPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.update.mockResolvedValue({ tokenVersion: 4 });
  });

  it("sifresiz hesapta mevcut sifre istemeden belirler ve oturumlari dusurur (ilk sifre)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: null, tokenVersion: 3 });
    const res = await setOwnPassword({ userId: "u1", newPassword: "Yeni-sifre9" });
    expect(res).toEqual({ ok: true, tokenVersion: 4, firstPassword: true });
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({
      passwordHash: "hashed:Yeni-sifre9",
      tokenVersion: { increment: 1 },
    });
  });

  it("sifreli hesapta mevcut sifre zorunlu", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "hashed:eski-sifre1", tokenVersion: 3 });
    expect(await setOwnPassword({ userId: "u1", newPassword: "Yeni-sifre9" })).toEqual({
      ok: false,
      reason: "current_password_required",
    });
    expect(await setOwnPassword({ userId: "u1", currentPassword: "yanlis", newPassword: "Yeni-sifre9" })).toEqual({
      ok: false,
      reason: "invalid_current_password",
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("dogru mevcut sifreyle degistirir ve tokenVersion'i artirir", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "hashed:eski-sifre1", tokenVersion: 3 });
    const res = await setOwnPassword({ userId: "u1", currentPassword: "eski-sifre1", newPassword: "Yeni-sifre9" });
    expect(res).toEqual({ ok: true, tokenVersion: 4, firstPassword: false });
    expect(mockPrisma.user.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
  });

  it("kisa sifreyi reddeder", async () => {
    expect(await setOwnPassword({ userId: "u1", newPassword: "kisa" })).toEqual({ ok: false, reason: "invalid_password" });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
