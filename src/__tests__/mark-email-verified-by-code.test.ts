import { describe, it, expect, vi } from "vitest";

/** Kodla giris dogrulanmamis e-postayi isaretler; dolu alana dokunmaz. */
const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: { user: { updateMany: vi.fn(), findUnique: vi.fn() }, booking: { findMany: vi.fn(async () => []) } } }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { markEmailVerifiedByCode, markEmailVerifiedByLogin } from "@/services/auth/verify-email";

describe("markEmailVerifiedByCode", () => {
  it("yalnızca boş emailVerified alanını doldurur", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    await markEmailVerifiedByCode("u1");
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
  });
});

/**
 * Hesap on-ele gecirme (2026-11-28): e-posta kanitlanmadan konmus sifre, adresin
 * sahibi girisle kanit getirdiginde duser.
 */
describe("markEmailVerifiedByLogin", () => {
  const dropCall = {
    where: { id: "u1", emailVerified: null, passwordHash: { not: null } },
    data: { emailVerified: expect.any(Date), passwordHash: null, tokenVersion: { increment: 1 } },
  };

  it("dogrulanmamis hesaptaki sifreyi siler, oturumlari dusurur ve yeni surumu doner", async () => {
    mockPrisma.user.updateMany.mockReset();
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 4, email: null, emailVerified: null });
    const res = await markEmailVerifiedByLogin("u1");
    expect(mockPrisma.user.updateMany).toHaveBeenNthCalledWith(1, dropCall);
    expect(res).toEqual({ passwordDropped: true, tokenVersion: 4 });
  });

  it("dogrulanmis ya da sifresiz hesapta sifreye dokunmaz", async () => {
    mockPrisma.user.updateMany.mockReset();
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, emailVerified: null });
    const res = await markEmailVerifiedByLogin("u1");
    expect(res).toEqual({ passwordDropped: false });
    // Ikinci cagri eski davranis: bos alani doldurur, baglamayi dener.
    expect(mockPrisma.user.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "u1", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
  });

  it("sifre sifirlama bu yolu cagirmaz (yeni sifreyi silmesin)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/services/auth/password-reset.ts", "utf8");
    expect(src).not.toMatch(/markEmailVerifiedByLogin/);
  });
});
