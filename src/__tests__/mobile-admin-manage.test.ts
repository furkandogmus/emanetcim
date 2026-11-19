import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  shop: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
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
  });

  it("admin kendini yasaklayamaz", async () => {
    await expect(adminUserService.setBanned("admin-1", true, actor)).resolves.toEqual({
      ok: false,
      error: "cannot_ban_self",
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("yasaklama token surumunu artirir", async () => {
    await expect(adminUserService.setBanned("u1", true, actor)).resolves.toEqual({ ok: true });
    expect(db.user.update.mock.calls[0][0].data).toEqual({ isBanned: true, tokenVersion: { increment: 1 } });
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
