import { BookingStatus } from "@prisma/client";
import prisma from "@/lib/db";

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
      prisma.shop.count({ where: { isActive: true } }),
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
