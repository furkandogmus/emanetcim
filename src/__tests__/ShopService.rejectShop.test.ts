import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockReleaseShopSeals } = vi.hoisted(() => ({
  mockReleaseShopSeals: vi.fn(),
  mockPrisma: {
    shop: { findUnique: vi.fn(), delete: vi.fn() },
    booking: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/SealService", () => ({
  sealService: { releaseShopSeals: mockReleaseShopSeals },
}));

import { shopService } from "@/services/ShopService";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.shop.findUnique.mockResolvedValue({ id: "s1" });
  mockPrisma.booking.count.mockResolvedValue(0);
  mockPrisma.shop.delete.mockResolvedValue({ id: "s1" });
  mockReleaseShopSeals.mockResolvedValue(3);
});

/**
 * Basvuru reddi. Govde iki tasiyicinin (web action + mobil admin ucu) ORTAK
 * yeri; daha once ayri ayri yazilmisti ve kopyalar farkli sekilde eksikti --
 * web muhurleri stoga dondurmuyordu, mobil denetim izi birakmiyordu.
 */
describe("dükkan başvurusu reddi", () => {
  it("dükkanı siler ve MÜHÜRLERİ STOĞA DÖNDÜRÜR", async () => {
    /*
      Asil kusur buydu: web kopyasi yalnizca siliyordu. Reddedilen dukkana
      ATANMIS muhurler dukkan silindikten sonra da atanmis gorunuyor ve
      envanterden sessizce dusuyordu.
    */
    const res = await shopService.rejectShop("s1");
    expect(res).toEqual({ ok: true, releasedSeals: 3 });
    expect(mockPrisma.shop.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(mockReleaseShopSeals).toHaveBeenCalledWith("s1");
  });

  it("AKTİF REZERVASYONU olan dükkanı silmez", async () => {
    // Silinirse misafirin elinde karsiligi olmayan bir rezervasyon kalir.
    mockPrisma.booking.count.mockResolvedValue(2);
    const res = await shopService.rejectShop("s1");
    expect(res).toEqual({ ok: false, reason: "has_active_bookings" });
    expect(mockPrisma.shop.delete).not.toHaveBeenCalled();
    expect(mockReleaseShopSeals).not.toHaveBeenCalled();
  });

  it("aktiflik kontrolü FK ihlaline değil, AÇIK SORGUYA dayanır", async () => {
    /*
      Onceki web kopyasi FK ihlalini yakalamaya guveniyordu. Silme, iliskinin
      `onDelete` davranisina gore BASARILI da olabilir -- o zaman kural hic
      uygulanmamis olurdu. Sorgu bu yuzden acikca yapiliyor.
    */
    await shopService.rejectShop("s1");
    expect(mockPrisma.booking.count).toHaveBeenCalledWith({
      where: { shopId: "s1", status: { in: ["APPROVED", "PAID", "CHECKED_IN"] } },
    });
  });

  it("olmayan dükkanı ayrı bir sebeple reddeder", async () => {
    // `not_found` ile `has_active_bookings` ayri: ilki 404, ikincisi 409.
    mockPrisma.shop.findUnique.mockResolvedValue(null);
    const res = await shopService.rejectShop("yok");
    expect(res).toEqual({ ok: false, reason: "not_found" });
    expect(mockPrisma.shop.delete).not.toHaveBeenCalled();
  });
});
