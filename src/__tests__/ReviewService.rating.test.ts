import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    review: { create: vi.fn(), aggregate: vi.fn() },
    shop: { update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { reviewService } from "@/services/ReviewService";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.review.create.mockResolvedValue({ id: "r1" });
  mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { id: 2 } });
  mockPrisma.shop.update.mockResolvedValue({ id: "s1" });
});

/**
 * `Shop.rating` misafire dükkan sayfasında ve arama sonuçlarında gösterilen
 * sayıdır — esnafın pazar yerindeki en görünür işareti.
 */
describe("dükkan ortalama puanı", () => {
  it("yorum eklenince puan güncellemesi BEKLENİR", async () => {
    /*
      Onceki hali `void this.updateShopAverageRating(...).catch(console.error)`
      idi: yorum yaziliyor ama yildiz GUNCELLENMEYEBILIYORDU ve tek iz
      `console.error`a dusen bir satirdi -- yapilandirilmis logger'a bile degil.
      Yeni yorumun hic etkisi olmamasi demekti.
    */
    await reviewService.addReview({
      bookingId: "b1", guestId: "g1", shopId: "s1", rating: 5,
    });
    expect(mockPrisma.shop.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { rating: 4.5 },
    });
  });

  it("puan güncellemesi başarısız olursa hata YUTULMAZ", async () => {
    // Yutmak, "yorumun kaydedildi" deyip yildizin eski kalmasi demekti.
    mockPrisma.shop.update.mockRejectedValue(new Error("db down"));
    await expect(
      reviewService.addReview({ bookingId: "b1", guestId: "g1", shopId: "s1", rating: 5 }),
    ).rejects.toThrow("db down");
  });

  it("hiç yorum kalmayınca puan SIFIRA döner", async () => {
    // Son yorum silindiginde `_avg.rating` null gelir; eski puanin kalmasi,
    // olmayan yorumlarin puani gostermesi olurdu.
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { id: 0 } });
    await reviewService.updateShopAverageRating("s1");
    expect(mockPrisma.shop.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { rating: 0 },
    });
  });

  it("ortalama TÜM yorumlardan hesaplanır — dükkana daraltılarak", async () => {
    await reviewService.updateShopAverageRating("s1");
    expect(mockPrisma.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: "s1" } }),
    );
  });
});
