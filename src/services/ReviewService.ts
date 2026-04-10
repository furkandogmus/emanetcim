import prisma from "@/lib/db";

/**
 * ReviewService - Misafir yorumlarını ve dükkan puanlarını yönetir.
 * UC_M_11 kapsamında 1-5 yıldız puanlama desteği.
 */
export class ReviewService {
  /**
   * Yeni bir yorum ekler ve dükkanın ortalama puanını günceller.
   */
  async addReview(data: {
    bookingId: string;
    guestId: string;
    shopId: string;
    rating: number;
    comment?: string;
  }) {
    // 1. Yorumu Kaydet
    const review = await prisma.review.create({
      data: {
        bookingId: data.bookingId,
        guestId: data.guestId,
        shopId: data.shopId,
        rating: data.rating,
        comment: data.comment
      }
    });

    // 2. Dükkanın Ortalama Puanını Yeniden Hesapla (Async/Background)
    void this.updateShopAverageRating(data.shopId).catch((err) =>
      console.error('[ReviewService] updateShopAverageRating failed:', err)
    );

    return review;
  }

  /**
   * Dükkanın tüm yorumlarını baz alarak ortalama puanı günceller.
   */
  private async updateShopAverageRating(shopId: string) {
    const aggregations = await prisma.review.aggregate({
      where: { shopId },
      _avg: { rating: true },
      _count: { id: true }
    });

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        rating: aggregations._avg.rating || 0
      }
    });
  }

  /**
   * Dükkana ait yorumları getirir.
   */
  async getShopReviews(shopId: string) {
    return await prisma.review.findMany({
      where: { shopId },
      include: {
        guest: {
          select: { name: true, image: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const reviewService = new ReviewService();
