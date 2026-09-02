import { describe, it, expect, vi } from "vitest";
import { applyDiscount } from "@/services/CouponService";

/**
 * INDIRIM ASLA FIYATI ARTIRMAZ.
 *
 * Gercek veritabaninda olculdu (2026-09-02): negatif bir `discount` degeri
 * fiyati YUKSELTIYORDU --
 *
 *     applyDiscount(240, -50, false) = 290
 *     gercek kupon: totalPrice 290, discountAmount -50
 *
 * Yani misafir "indirim kuponu" girip elli lira FAZLA oduyor ve deftere
 * negatif bir indirim yaziliyordu.
 *
 * Admin action zaten doguruyor (`discount: z.number().positive()`), yani bu
 * deger arayuzden gelemez. Ama bu fonksiyon VERITABANINDAN gelen bir degeri
 * isliyor: elle yazilmis bir satir, bir bakim scripti ya da eski bir kayit
 * yeter. Aritmetigin kendisi guvenli olmali.
 */
describe("applyDiscount", () => {
  it.each([
    ["negatif tutar indirimi", 240, -50, false, 240],
    ["negatif yuzde indirimi", 240, -20, true, 240],
    ["yuzde 100'de tavanlanir", 240, 500, true, 0],
    ["tutar fiyati gecerse sifir", 50, 200, false, 0],
    ["normal yuzde", 240, 25, true, 180],
    ["normal tutar", 240, 40, false, 200],
    ["sifir indirim", 240, 0, false, 240],
  ])("%s", (_ad, fiyat, indirim, yuzdeMi, beklenen) => {
    expect(applyDiscount(fiyat, indirim, yuzdeMi)).toBe(beklenen);
  });

  it("hicbir girdi fiyati ARTIRAMAZ", () => {
    for (const fiyat of [0, 1, 50, 240, 10_000]) {
      for (const indirim of [-1000, -50, -0.5, 0, 10, 100, 500]) {
        for (const yuzde of [true, false]) {
          expect(
            applyDiscount(fiyat, indirim, yuzde),
            `${fiyat} / ${indirim} / ${yuzde}`,
          ).toBeLessThanOrEqual(Math.round(fiyat * 100) / 100);
        }
      }
    }
  });
});

/**
 * KUPON OLUSTURMA KAPISI.
 *
 * Servis dogrudan cagrildiginda su kuponlar kayda giriyordu: %500 indirim,
 * -50 TL indirim, `maxUses: -1` (hic kullanilamayan sessiz olu kupon),
 * `minPrice: -100`.
 */
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { coupon: { create: mockCreate } } }));

const { createCoupon } = await import("@/services/CouponService");

describe("createCoupon girdi kapisi", () => {
  it.each([
    ["negatif indirim", { discount: -50, isPercent: false }],
    ["sifir indirim", { discount: 0, isPercent: false }],
    ["yuzde 100 ustu", { discount: 500, isPercent: true }],
    ["maxUses -1", { discount: 10, isPercent: true, maxUses: -1 }],
    ["maxUses 0", { discount: 10, isPercent: true, maxUses: 0 }],
    ["negatif minPrice", { discount: 10, isPercent: true, minPrice: -100 }],
  ])("%s reddediliyor", async (_ad, veri) => {
    mockCreate.mockClear();
    const temel = {
      code: "TEST",
      discount: 10,
      isPercent: true,
      minPrice: null,
      maxUses: 5,
      expiresAt: null,
    };
    const r = await createCoupon({ ...temel, ...veri } as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
    expect(mockCreate, "gecersiz kupon veritabanina GITMEMELI").not.toHaveBeenCalled();
  });

  it("gecerli kupon GECIYOR", async () => {
    mockCreate.mockClear();
    mockCreate.mockResolvedValue({ id: "c1", code: "TEST" });
    const r = await createCoupon({
      code: "TEST", discount: 25, isPercent: true, minPrice: null, maxUses: 5, expiresAt: null,
    } as never);
    expect(r.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("sinirsiz kullanim (maxUses null) gecerli", async () => {
    mockCreate.mockClear();
    mockCreate.mockResolvedValue({ id: "c2", code: "SINIRSIZ" });
    const r = await createCoupon({
      code: "SINIRSIZ", discount: 10, isPercent: false, minPrice: null, maxUses: null, expiresAt: null,
    } as never);
    expect(r.ok).toBe(true);
  });
});
