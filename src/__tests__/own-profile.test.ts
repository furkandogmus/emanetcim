import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/** Web profil sayfasi ve mobil `/auth/me` AYNI govdeyi kullanir (kural 2, 2026-11-22). */
const { mockPrisma, updatePhone, requireUser, setOwnPassword } = vi.hoisted(() => ({
  mockPrisma: { user: { update: vi.fn(), findUnique: vi.fn() } },
  updatePhone: vi.fn(),
  requireUser: vi.fn(),
  setOwnPassword: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/PartnerProfileService", () => ({ partnerProfileService: { updatePhone } }));
vi.mock("@/lib/action-auth", () => ({ requireUser }));
vi.mock("@/services/auth/set-own-password", () => ({ setOwnPassword }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/mail", () => ({ sendPasswordSetNotice: vi.fn(async () => undefined) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "tr") }));

const { updateOwnProfile } = await import("@/services/auth/own-profile");
const { updateProfileAction, changePasswordAction } = await import("@/actions/profile");

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ ok: true, actor: { id: "u1", role: "GUEST" } });
  updatePhone.mockResolvedValue({ ok: true, phone: "5551112233" });
});

describe("updateOwnProfile", () => {
  it("bos ya da 100+ karakter ad reddedilir, hicbir sey yazilmaz", async () => {
    expect(await updateOwnProfile({ userId: "u1", name: "  " })).toEqual({ ok: false, reason: "invalid_name" });
    expect(await updateOwnProfile({ userId: "u1", name: "a".repeat(101) })).toEqual({ ok: false, reason: "invalid_name" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(updatePhone).not.toHaveBeenCalled();
  });

  it("telefon giris-kilidi servisinden gecer; red adi da yazdirmaz", async () => {
    updatePhone.mockResolvedValue({ ok: false, reason: "login_phone_locked" });
    expect(await updateOwnProfile({ userId: "u1", name: "Ada", phone: "" })).toEqual({ ok: false, reason: "phone_locked" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("cakisma phone_taken olur", async () => {
    updatePhone.mockResolvedValue({ ok: false, reason: "already_registered" });
    expect(await updateOwnProfile({ userId: "u1", phone: "5551112233" })).toEqual({ ok: false, reason: "phone_taken" });
  });

  it("ad kirpilarak yazilir", async () => {
    expect(await updateOwnProfile({ userId: "u1", name: "  Ada  ", phone: "5551112233" })).toEqual({ ok: true });
    expect(updatePhone).toHaveBeenCalledWith("u1", "5551112233");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Ada" } });
  });

  it("alan yoksa no_fields", async () => {
    expect(await updateOwnProfile({ userId: "u1" })).toEqual({ ok: false, reason: "no_fields" });
  });
});

describe("web profil action'lari", () => {
  it("profil kaydi ortak servisi cagirir ve hatayi Errors anahtarina cevirir", async () => {
    expect(await updateProfileAction({ name: "", phone: "" })).toEqual({ ok: false, error: "Errors.invalidName" });
    expect(await updateProfileAction({ name: "Ada", phone: "5551112233" })).toEqual({ ok: true });
  });

  it("oturumsuz kullanici reddedilir", async () => {
    requireUser.mockResolvedValue({ ok: false, error: "Errors.authRequired" });
    expect(await updateProfileAction({ name: "Ada", phone: "" })).toEqual({ ok: false, error: "Errors.authRequired" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("sifre degisimi setOwnPassword'u goruntuleme bilgisi OLMADAN cagirir", async () => {
    setOwnPassword.mockResolvedValue({ ok: false, reason: "invalid_current_password" });
    expect(await changePasswordAction({ currentPassword: "x", newPassword: "y".repeat(10) })).toEqual({
      ok: false,
      error: "Errors.invalidCurrentPassword",
    });
    expect(setOwnPassword).toHaveBeenCalledWith({ userId: "u1", currentPassword: "x", newPassword: "y".repeat(10) });

    setOwnPassword.mockResolvedValue({ ok: true, tokenVersion: 4, rotated: true });
    expect(await changePasswordAction({ currentPassword: "x", newPassword: "y".repeat(10) })).toEqual({
      ok: true,
      rotated: true,
    });
  });

  it("mevcut sifre gerekliyse anahtar doner", async () => {
    setOwnPassword.mockResolvedValue({ ok: false, reason: "current_password_required" });
    expect((await changePasswordAction({ newPassword: "y".repeat(10) })).ok).toBe(false);
  });
});

describe("tek govde", () => {
  it("mobil /auth/me ve /auth/me/password ile web action ayni servisleri kullanir", () => {
    const web = read("src/actions/profile.ts");
    expect(web).toMatch(/updateOwnProfile\(/);
    expect(web).toMatch(/setOwnPassword\(/);
    expect(read("src/app/api/mobile/auth/me/route.ts")).toMatch(/updateOwnProfile\(/);
    expect(read("src/app/api/mobile/auth/me/password/route.ts")).toMatch(/setOwnPassword\(/);
    // Ad kurali uc tarafinda yeniden yazilmadi.
    expect(read("src/app/api/mobile/auth/me/route.ts")).not.toMatch(/invalid_name/);
  });
});
