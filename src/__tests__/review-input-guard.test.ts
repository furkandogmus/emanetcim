import { describe, it, expect, vi } from "vitest";

/**
 * PUAN VE YORUM SINIRLARI SERVISTE.
 *
 * Gercek veritabaninda olculdu (2026-09-02). Servis dogrudan cagrildiginda
 * sunlar KAYDEDILIYORDU --
 *
 *     puan 10, puan -3, puan 0, 50.000 karakterlik yorum
 *     -> dukkanin ortalamasi 3.5'e dustu
 *
 * ...ve 5'IN USTUNE de cikabilirdi. Bu yalnizca bir rozet degil:
 * `ShopService.ratingScore` arama SIRALAMASINI besliyor ve `(r > 0 ? r : 3) / 5`
 * ile normalize ediyor. Puan 10 olan bir dukkan oradan 2.0 alir -- 0-1 arasi
 * olmasi gereken bilesende iki kat agirlik. Tek bir hatali puan siralamayi
 * bozar.
 *
 * Iki tasiyici da 1-5 doguruyordu AMA AYNI SEKILDE DEGIL: web
 * `Number.isInteger` ile 4.7'yi reddediyor, mobil `Math.round` ile 5'e
 * yuvarliyordu -- ayni girdi iki tasiyicida iki farkli sonuc. Kural artik tek
 * yerde.
 *
 * YORUM UZUNLUGU HICBIR YERDE SINIRLI DEGILDI. `getShopReviews` elli yorum
 * cekiyor; elli tane elli bin karakterlik yorum iki bucuk megabaytlik bir
 * dukkan sayfasi demek.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    review: { create: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    shop: { update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

const { reviewService, MAX_REVIEW_COMMENT_LENGTH } = await import("@/services/ReviewService");

function girdi(over: Record<string, unknown> = {}) {
  return {
    bookingId: "b1",
    guestId: "g1",
    shopId: "s1",
    rating: 5,
    comment: "iyi",
    ...over,
  };
}

async function hatayiYakala(over: Record<string, unknown>) {
  mockPrisma.review.create.mockClear();
  try {
    await reviewService.addReview(girdi(over) as never);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
}

describe("yorum girdi kapisi", () => {
  it.each([
    ["puan 0", { rating: 0 }],
    ["puan 6", { rating: 6 }],
    ["puan 10", { rating: 10 }],
    ["puan -3", { rating: -3 }],
    ["kesirli puan", { rating: 4.7 }],
    ["NaN puan", { rating: Number.NaN }],
  ])("%s reddediliyor", async (_ad, over) => {
    const hata = await hatayiYakala(over);
    expect(hata).toBe("REVIEW_INVALID_RATING");
    expect(mockPrisma.review.create, "gecersiz puan KAYDEDILMEMELI").not.toHaveBeenCalled();
  });

  it("sinirdan uzun yorum reddediliyor", async () => {
    const hata = await hatayiYakala({ comment: "x".repeat(MAX_REVIEW_COMMENT_LENGTH + 1) });
    expect(hata).toBe("REVIEW_COMMENT_TOO_LONG");
    expect(mockPrisma.review.create).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4, 5])("puan %i KABUL ediliyor", async (rating) => {
    mockPrisma.review.create.mockClear();
    mockPrisma.review.create.mockResolvedValue({ id: "r1", rating });
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating }, _count: 1 });
    mockPrisma.review.findMany.mockResolvedValue([{ rating }]);
    mockPrisma.shop.update.mockResolvedValue({ id: "s1" });
    await reviewService.addReview(girdi({ rating }) as never);
    expect(mockPrisma.review.create).toHaveBeenCalled();
  });

  it("tam sinirdaki yorum KABUL ediliyor", async () => {
    mockPrisma.review.create.mockClear();
    mockPrisma.review.create.mockResolvedValue({ id: "r1", rating: 5 });
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: 1 });
    mockPrisma.review.findMany.mockResolvedValue([{ rating: 5 }]);
    mockPrisma.shop.update.mockResolvedValue({ id: "s1" });
    await reviewService.addReview(girdi({ comment: "x".repeat(MAX_REVIEW_COMMENT_LENGTH) }) as never);
    expect(mockPrisma.review.create).toHaveBeenCalled();
  });

  it("yorumsuz kayit KABUL ediliyor", async () => {
    mockPrisma.review.create.mockClear();
    mockPrisma.review.create.mockResolvedValue({ id: "r1", rating: 4 });
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4 }, _count: 1 });
    mockPrisma.review.findMany.mockResolvedValue([{ rating: 4 }]);
    mockPrisma.shop.update.mockResolvedValue({ id: "s1" });
    await reviewService.addReview(girdi({ rating: 4, comment: undefined }) as never);
    expect(mockPrisma.review.create).toHaveBeenCalled();
  });
});
