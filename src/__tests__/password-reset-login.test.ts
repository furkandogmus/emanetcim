import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `resolvePasswordResetLogin`: yeni şifre sayfası, bağdaki token'dan hesabın
 * giriş kimliğini şifre yöneticisi için çözer. Kimlik YALNIZCA geçerli, süresi
 * dolmamış bir ŞİFRE SIFIRLAMA token'ından çıkar; başka her şey `null`.
 */
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { verificationToken: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { resolvePasswordResetLogin } from "@/lib/password-reset-token";

const future = () => new Date(Date.now() + 60_000);
const row = (identifier: string, expires = future()) => ({ identifier, token: "t-1", expires });

beforeEach(() => {
  mockPrisma.verificationToken.findUnique.mockReset();
});

describe("resolvePasswordResetLogin", () => {
  it("bilinmeyen token: null", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(null);
    expect(await resolvePasswordResetLogin("yok")).toBeNull();
    expect(mockPrisma.verificationToken.findUnique).toHaveBeenCalledWith({ where: { token: "yok" } });
  });

  it("boş token veritabanına hiç sorulmaz", async () => {
    expect(await resolvePasswordResetLogin("   ")).toBeNull();
    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("süresi dolmuş token: null", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(
      row("password-reset:misafir@example.com", new Date(Date.now() - 1000)),
    );
    expect(await resolvePasswordResetLogin("t-1")).toBeNull();
  });

  it("şifre sıfırlama OLMAYAN doğrulama token'ı (e-posta doğrulama): null", async () => {
    // verify-email token'ları ham e-postayı identifier olarak tutar.
    mockPrisma.verificationToken.findUnique.mockResolvedValue(row("misafir@example.com"));
    expect(await resolvePasswordResetLogin("t-1")).toBeNull();
  });

  it("e-posta önekli token: e-posta döner", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(row("password-reset:misafir@example.com"));
    expect(await resolvePasswordResetLogin("t-1")).toBe("misafir@example.com");
  });

  it("telefon önekli token: telefon döner (e-posta öneki sanılmaz)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(row("password-reset:phone:5551112233"));
    expect(await resolvePasswordResetLogin("t-1")).toBe("5551112233");
  });

  it("öneki olup kimliği boş token: null", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(row("password-reset:"));
    expect(await resolvePasswordResetLogin("t-1")).toBeNull();
  });
});
