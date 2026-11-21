import { describe, it, expect, vi, beforeEach } from "vitest";

const { db, notify } = vi.hoisted(() => ({
  db: {
    shop: { findUnique: vi.fn() },
    mobilePushToken: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  notify: { sendEmail: vi.fn(), sendSms: vi.fn(), sendMobilePush: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/services/NotificationService", () => ({ notificationService: notify }));

import { shopService } from "@/services/ShopService";

const shop = {
  id: "s1",
  name: "Dukkan",
  ownerId: "o1",
  latitude: 36.9,
  longitude: 30.7,
  approvedAt: null,
  owner: { email: null, phone: "5320000000", name: "Esnaf" },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.shop.findUnique.mockResolvedValue(shop);
  db.$transaction.mockResolvedValue(undefined);
  notify.sendEmail.mockResolvedValue(undefined);
  notify.sendSms.mockResolvedValue(undefined);
  notify.sendMobilePush.mockResolvedValue(undefined);
});

describe("ShopService.approveShop bildirim kanallari", () => {
  it("push token'i varsa push gonderir ve notified.push=true doner", async () => {
    db.mobilePushToken.count.mockResolvedValue(1);
    const res = await shopService.approveShop("s1");
    expect(res).toEqual({ ok: true, notified: { email: false, push: true } });
    expect(notify.sendMobilePush).toHaveBeenCalledWith("o1", expect.any(String), expect.any(String));
  });

  it("push hatasi onayi bozmaz (yakalanir)", async () => {
    db.mobilePushToken.count.mockResolvedValue(2);
    notify.sendMobilePush.mockRejectedValue(new Error("expo down"));
    const res = await shopService.approveShop("s1");
    await Promise.resolve();
    expect(res.ok).toBe(true);
  });

  it("token yoksa push denenmez", async () => {
    db.mobilePushToken.count.mockResolvedValue(0);
    const res = await shopService.approveShop("s1");
    expect(res).toEqual({ ok: true, notified: { email: false, push: false } });
    expect(notify.sendMobilePush).not.toHaveBeenCalled();
  });
});
