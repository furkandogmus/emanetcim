import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  shop: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  mobilePushToken: { deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
}));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));

import { shopService } from "@/services/ShopService";
import { adminUserService } from "@/services/AdminUserService";
import { shopVisibilityIssues } from "@/lib/shop-visibility";

const actor = { userId: "admin-1", ip: null };

describe("ShopService.adminUpdateShop (web + mobil admin)", () => {
  beforeEach(() => {
    db.shop.findUnique.mockReset().mockResolvedValue({ id: "s1" });
    db.shop.update.mockReset().mockResolvedValue({ name: "Dukkan" });
  });

  it.each([
    [{ capacity: 0 }],
    [{ capacity: 2.5 }],
    [{ pricePerDay: 0 }],
    [{ name: "  " }],
    [{ longitude: 3e16 }],
  ])("gecersiz alani yazmadan reddeder: %o", async (data) => {
    await expect(shopService.adminUpdateShop("s1", data, actor)).resolves.toEqual({
      ok: false,
      error: "Errors.invalidData",
    });
    expect(db.shop.update).not.toHaveBeenCalled();
  });

  it("bayraklari ve fiyati yazar", async () => {
    await expect(
      shopService.adminUpdateShop("s1", { isActive: false, isVerified: true, pricePerDay: 300 }, actor),
    ).resolves.toEqual({ ok: true });
    const { data } = db.shop.update.mock.calls[0][0];
    expect(data.isActive).toBe(false);
    expect(data.isVerified).toBe(true);
    expect(Number(data.pricePerDay)).toBe(300);
  });

  it("aktif ederken approvedAt'i bir kez yazar, var olani ezmez", async () => {
    db.shop.findUnique.mockResolvedValue({ id: "s1", approvedAt: null });
    await shopService.adminUpdateShop("s1", { isActive: true }, actor);
    expect(db.shop.update.mock.calls[0][0].data.approvedAt).toBeInstanceOf(Date);

    db.shop.update.mockClear();
    db.shop.findUnique.mockResolvedValue({ id: "s1", approvedAt: new Date("2026-01-01") });
    await shopService.adminUpdateShop("s1", { isActive: true }, actor);
    expect(db.shop.update.mock.calls[0][0].data).not.toHaveProperty("approvedAt");
  });

  it("olmayan dukkan not_found doner", async () => {
    db.shop.findUnique.mockResolvedValue(null);
    await expect(shopService.adminUpdateShop("yok", { isActive: true }, actor)).resolves.toEqual({
      ok: false,
      error: "Errors.notFound",
    });
  });
});

describe("AdminUserService.setBanned", () => {
  beforeEach(() => {
    db.user.findUnique.mockReset().mockResolvedValue({ id: "u1" });
    db.user.update.mockReset().mockResolvedValue({});
    db.mobilePushToken.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  });

  it("admin kendini yasaklayamaz", async () => {
    await expect(adminUserService.setBanned("admin-1", true, actor)).resolves.toEqual({
      ok: false,
      error: "cannot_ban_self",
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("ADMIN hesabi yasaklanamaz", async () => {
    db.user.findUnique.mockResolvedValue({ id: "a2", role: "ADMIN" });
    await expect(adminUserService.setBanned("a2", true, actor)).resolves.toEqual({
      ok: false,
      error: "cannot_ban_admin",
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("yasaklama token surumunu artirir", async () => {
    await expect(adminUserService.setBanned("u1", true, actor)).resolves.toEqual({ ok: true });
    expect(db.user.update.mock.calls[0][0].data).toEqual({ isBanned: true, tokenVersion: { increment: 1 } });
  });

  // Bulgu 125: oturumu dusen cihaz bildirim de almasin.
  it("yasaklama cihazlarin bildirim kayitlarini siler, yasak kaldirma silmez", async () => {
    await adminUserService.setBanned("u1", true, actor);
    expect(db.mobilePushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });

    db.mobilePushToken.deleteMany.mockClear();
    await adminUserService.setBanned("u1", false, actor);
    expect(db.mobilePushToken.deleteMany).not.toHaveBeenCalled();
  });
});

describe("shopVisibilityIssues", () => {
  const base = { isActive: true, latitude: 1, longitude: 1, image: "/a.jpg", cityPages: ["antalya"] };
  it("sorunsuz dukkan bos liste", () => expect(shopVisibilityIssues(base)).toEqual([]));
  it("konumsuz dukkanda sehir sayfasi ayrica sayilmaz", () =>
    expect(shopVisibilityIssues({ ...base, latitude: null, cityPages: [], image: null, isActive: false })).toEqual([
      "inactive",
      "noLocation",
      "noPhoto",
    ]));
});

describe("fullAddress", () => {
  it("adreste gecen semt ve ili tekrar eklemez", async () => {
    const { fullAddress } = await import("@/lib/mobile-dto");
    expect(fullAddress("Galata Kulesi Sk. No:12, Beyoğlu, İstanbul", "Beyoğlu", "İstanbul")).toBe(
      "Galata Kulesi Sk. No:12, Beyoğlu, İstanbul",
    );
    expect(fullAddress("Atatürk Cd. 5", "Muratpaşa", "Antalya")).toBe("Atatürk Cd. 5, Muratpaşa, Antalya");
    expect(fullAddress(null, "Kepez", "Antalya")).toBe("Kepez, Antalya");
  });
});
