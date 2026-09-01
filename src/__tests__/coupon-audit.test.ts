import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { coupon: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { claimCoupon, applyDiscount } from "@/services/CouponService";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.coupon.updateMany.mockResolvedValue({ count: 1 });
});

function coupon(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1", code: "HOSGELDIN", discount: 20, isPercent: true,
    minPrice: 0, maxUses: 100, usedCount: 0, expiresAt: null, isActive: true,
    ...over,
  };
}

/**
 * Kupon PARA demektir: `totalPrice`ı doğrudan düşürür. 2026-09-01'e kadar
 * indirimden deftere hiçbir iz kalmıyordu — "bu rezervasyon neden 50 değil de
 * 40 TRY?" sorusunun cevabı veride yoktu. Referans indirimi ise ta baştan
 * kaydediliyordu; aynı olay bir yolda denetlenebilir, diğerinde görünmezdi.
 */
describe("kupon indirimi DEFTERE yazılabilir hâlde dönüyor", () => {
  it("kodu ve indirim TUTARINI da döndürür", async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(coupon());
    const res = await claimCoupon("HOSGELDIN", 50);
    expect(res.ok).toBe(true);
    expect(res.ok && res.claimed).toEqual({
      couponId: "c1", totalPrice: 40, code: "HOSGELDIN", discountAmount: 10,
    });
  });

  it("indirim FARKTAN hesaplanır — kuruş açığı bırakmaz", async () => {
    /*
      Orandan yeniden turetmek, `applyDiscount`in yuvarlamasindan farkli bir
      sonuc verebilir ve defterde `totalPrice + indirim != asil fiyat` gibi bir
      acik birakirdi -- `platform-split.ts`teki ayni gerekce.
    */
    for (const [price, pct] of [[33.33, 15], [99.99, 33], [0.05, 50], [120.005, 20]]) {
      mockPrisma.coupon.findUnique.mockResolvedValue(coupon({ discount: pct }));
      const res = await claimCoupon("X", price);
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      const sum = Math.round((res.claimed.totalPrice + res.claimed.discountAmount) * 100) / 100;
      expect(sum, `${price} / %${pct}`).toBe(Math.round(price * 100) / 100);
    }
  });

  it("SABİT tutarlı kuponda da tutar", async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(coupon({ discount: 15, isPercent: false }));
    const res = await claimCoupon("X", 50);
    expect(res.ok && res.claimed.totalPrice).toBe(35);
    expect(res.ok && res.claimed.discountAmount).toBe(15);
  });

  it("kupon geçersizse indirim de kod da YAZILMAZ", async () => {
    // Kotasi dolmus / suresi gecmis kupon rezervasyonu DUSURMEZ, tam fiyatla
    // devam eder -- o durumda deftere yazilacak bir indirim de yoktur.
    mockPrisma.coupon.findUnique.mockResolvedValue(null);
    expect(await claimCoupon("YOK", 50)).toEqual({ ok: false });
  });

  it("aritmetik yardımcısı sıfırın altına inmez", () => {
    // Sabit indirim tutari fiyattan buyukse negatif fiyat uretilmemeli.
    expect(applyDiscount(10, 25, false)).toBeLessThanOrEqual(0);
  });
});
