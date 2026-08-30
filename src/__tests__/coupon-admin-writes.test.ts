import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Kupon YAZMA yolu (admin ekranı).
 *
 * NEDEN TEST EDİLİYOR: kupon indirim, indirim de paradır — `Coupon`,
 * `service-layer-writes` mandalının servis dışından yazmayı KESİN yasakladığı
 * modellerden biri. Bu iki fonksiyon o kuralın karşılığı: admin ekranı
 * Prisma'ya değil buraya konuşur.
 *
 * Asıl korunan davranış ÇAKIŞMA: kod tekilliğini veritabanı zorluyor
 * (`@unique`). Önce `findUnique` ile bakıp sonra yazan bir kod, iki eşzamanlı
 * istekte ikisinin de "müsait" görmesine izin verirdi. P2002'yi yakalamak
 * yarışsız tek yol — ve yakalanmazsa yönetici "Bilinmeyen bir hata" okur.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    coupon: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { createCoupon, setCouponActive, normalizeCouponCode } from "@/services/CouponService";

beforeEach(() => vi.clearAllMocks());

const INPUT = {
  code: "yaz25",
  discount: 25,
  isPercent: true,
  minPrice: null,
  maxUses: 100,
  expiresAt: null,
};

describe("kupon oluşturma", () => {
  it("kodu boşluksuz ve BÜYÜK harfe indirger", () => {
    // Misafir kodu elle yazar; "yaz25" ile "YAZ25" ayni kupon olmali.
    expect(normalizeCouponCode("  yaz25 ")).toBe("YAZ25");
  });

  it("kodu normalize ederek yazar", async () => {
    mockPrisma.coupon.create.mockResolvedValue({ id: "c1", code: "YAZ25" });

    const result = await createCoupon({ ...INPUT, code: "  yaz25 " });

    expect(result).toEqual({ ok: true, id: "c1", code: "YAZ25" });
    expect(mockPrisma.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "YAZ25", isActive: true }),
      }),
    );
  });

  it("aynı kod ikinci kez yazılırsa FIRLATMAZ, sebebi söyler", async () => {
    mockPrisma.coupon.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(createCoupon(INPUT)).resolves.toEqual({
      ok: false,
      reason: "duplicate_code",
    });
  });

  it("BAŞKA bir veritabanı hatasını yutmaz", async () => {
    // Yutulsaydi "kod zaten var" derdik; sebep bambaska olabilir ve gercek
    // ariza gorunmez hale gelirdi.
    mockPrisma.coupon.create.mockRejectedValue(new Error("connection lost"));
    await expect(createCoupon(INPUT)).rejects.toThrow("connection lost");
  });
});

describe("kupon açma/kapatma", () => {
  it("silmez, yalnızca `isActive` değiştirir", async () => {
    // Kullanilmis bir kuponu silmek, o kuponla yapilmis rezervasyonlarin
    // indiriminin nereden geldigini yok eder.
    mockPrisma.coupon.update.mockResolvedValue({});

    await setCouponActive("c1", false);

    expect(mockPrisma.coupon.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { isActive: false },
    });
  });
});
