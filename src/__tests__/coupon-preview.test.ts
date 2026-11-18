import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, updateMany } = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { coupon: { findUnique, updateMany } } }));

import { claimCoupon, previewCoupon, releaseCouponByCode } from "@/services/CouponService";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COUPON = {
  id: "c1",
  code: "YAZ10",
  discount: 10,
  isPercent: true,
  isActive: true,
  expiresAt: null,
  minPrice: 0,
  maxUses: null,
  usedCount: 0,
};

describe("kupon onizleme ve kod bicimi", () => {
  beforeEach(() => {
    findUnique.mockReset();
    updateMany.mockReset();
  });

  it("kucuk harf ve bosluklu kod buyuk harfli kuponu bulur (hak alma)", async () => {
    findUnique.mockResolvedValue(COUPON);
    updateMany.mockResolvedValue({ count: 1 });
    const res = await claimCoupon("  yaz10 ", 200);
    expect(findUnique).toHaveBeenCalledWith({ where: { code: "YAZ10" } });
    expect(res.ok && res.claimed.totalPrice).toBe(180);
  });

  it("onizleme kotayi ALMAZ ve ayni tutari verir", async () => {
    findUnique.mockResolvedValue(COUPON);
    const res = await previewCoupon("yaz10", 200);
    expect(res).toEqual({ ok: true, code: "YAZ10", totalPrice: 180, discountAmount: 20 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("alt limit altinda sebebi ve limiti soyler", async () => {
    findUnique.mockResolvedValue({ ...COUPON, minPrice: 300 });
    expect(await previewCoupon("YAZ10", 200)).toEqual({ ok: false, reason: "min_price", minPrice: 300 });
  });

  it("kotasi dolmus, pasif ya da suresi gecmis kupon gecersiz", async () => {
    for (const row of [
      { ...COUPON, maxUses: 5, usedCount: 5 },
      { ...COUPON, isActive: false },
      { ...COUPON, expiresAt: new Date("2020-01-01") },
    ]) {
      findUnique.mockResolvedValue(row);
      expect(await previewCoupon("YAZ10", 200)).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("iptalde kupon hakki koda gore geri verilir, sayac eksiye inmez", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await releaseCouponByCode(" yaz10 ");
    expect(updateMany).toHaveBeenCalledWith({
      where: { code: "YAZ10", usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
});

describe("iptal ve mobil rezervasyon ucu", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf-8");
  it("check-in oncesi iptal kupon hakkini geri verir", () => {
    expect(read("src/services/booking/lifecycle.ts")).toContain("couponService.releaseByCode(booking.couponCode)");
  });
  it("mobil rezervasyon ucu web ile ayni hiz sinirini uygular", () => {
    const uc = read("src/app/api/mobile/checkout/intent/route.ts");
    expect(uc).toContain("booking_create:${ip}");
    expect(uc).toContain("booking_create_user:${auth.user.id}");
  });
});
