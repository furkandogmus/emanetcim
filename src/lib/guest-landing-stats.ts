import { BookingStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { PUBLIC_SHOP_FILTER } from "@/lib/public-shop-filter";

export type GuestLandingStats = {
  activeLocations: number;
  completedStays: number;
  reviewCount: number;
  averageRating: number | null;
};

const empty: GuestLandingStats = {
  activeLocations: 0,
  completedStays: 0,
  reviewCount: 0,
  averageRating: null,
};

/**
 * Ana sayfa güven bandı için hafif özet sayımlar (ISR ile önbelleklenebilir).
 */
export async function getGuestLandingStats(): Promise<GuestLandingStats> {
  try {
    const [activeLocations, completedStays, reviewAgg] = await Promise.all([
      // Test dükkanları sayılmaz: ana sayfadaki "aktif lokasyon" rakamı
      // gerçek kapasiteyi göstermeli (P1-4).
      prisma.shop.count({ where: PUBLIC_SHOP_FILTER }),
      prisma.booking.count({ where: { status: BookingStatus.CHECKED_OUT } }),
      prisma.review.aggregate({
        _count: { _all: true },
        _avg: { rating: true },
      }),
    ]);

    const avg = reviewAgg._avg.rating;
    return {
      activeLocations,
      completedStays,
      reviewCount: reviewAgg._count._all,
      averageRating: avg != null ? Math.round(avg * 10) / 10 : null,
    };
  } catch {
    return empty;
  }
}
