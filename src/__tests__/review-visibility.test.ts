import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gizlenen yorum misafirin gordugu HICBIR yuzeyde yok (2026-11-23).
 *
 * Gizleme bir kolon; filtre her okumada ayri ayri yaziliyor. Dorduncu bir okuma
 * yeri eklendiginde biri unutuluyor -- `public-shop-filter`in yasadigi sinif.
 * Bu test her misafir okumasinin `hiddenAt: null` tasidigini olcer.
 */
const db = vi.hoisted(() => ({
  review: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  shop: { findFirst: vi.fn(), count: vi.fn() },
  booking: { count: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ default: db }));

import { reviewService } from "@/services/ReviewService";
import { shopService } from "@/services/ShopService";
import { getHomeTestimonials } from "@/lib/home-testimonials";
import { getGuestLandingStats } from "@/lib/guest-landing-stats";

const whereOf = (fn: { mock: { calls: unknown[][] } }) => (fn.mock.calls[0][0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  db.review.findMany.mockResolvedValue([]);
  db.review.count.mockResolvedValue(0);
  db.review.aggregate.mockResolvedValue({ _count: { _all: 0 }, _avg: { rating: null } });
  db.shop.findFirst.mockResolvedValue(null);
  db.shop.count.mockResolvedValue(0);
  db.booking.count.mockResolvedValue(0);
});

describe("misafir yorum okumalari gizlenenleri disarida birakir", () => {
  it("mobil dukkan yorumlari (eski dizi ve sayfali) ve toplam", async () => {
    await reviewService.getShopReviews("s1");
    expect(whereOf(db.review.findMany)).toMatchObject({ shopId: "s1", hiddenAt: null });

    db.review.findMany.mockClear();
    await reviewService.listShopReviews("s1");
    expect(whereOf(db.review.findMany)).toMatchObject({ shopId: "s1", hiddenAt: null });
    expect(whereOf(db.review.count)).toMatchObject({ shopId: "s1", hiddenAt: null });
  });

  it("web dukkan sayfasi (ve JSON-LD reviewCount)", async () => {
    await shopService.getShopPublicDetail("s1");
    const arg = db.shop.findFirst.mock.calls[0][0] as { include: { reviews: { where: unknown } } };
    expect(arg.include.reviews.where).toMatchObject({ hiddenAt: null });
  });

  it("ana sayfa yorumlari ve guven istatistigi", async () => {
    await getHomeTestimonials();
    expect(whereOf(db.review.findMany)).toMatchObject({ hiddenAt: null });
    await getGuestLandingStats();
    expect(whereOf(db.review.aggregate)).toMatchObject({ hiddenAt: null });
  });

  it("yonetici listesi gizlenenleri GOSTERIR, filtreler dogru daraltir", async () => {
    await reviewService.listForAdmin({ filter: "all" });
    expect(whereOf(db.review.findMany)).toEqual({});
    db.review.findMany.mockClear();
    await reviewService.listForAdmin({ shopId: "s1", filter: "low" });
    expect(whereOf(db.review.findMany)).toEqual({ shopId: "s1", rating: { lte: 2 } });
    db.review.findMany.mockClear();
    await reviewService.listForAdmin({ filter: "hidden" });
    expect(whereOf(db.review.findMany)).toEqual({ hiddenAt: { not: null } });
  });
});
