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

    /*
      2. Ortalama puanı yeniden hesapla -- ARTIK BEKLENIYOR.

      Onceki hali `void ... .catch(console.error)` idi: yorum yaziliyor ama
      dukkanin yildizi GUNCELLENMEYEBILIYORDU ve bunun tek izi `console.error`a
      dusen bir satirdi. `Shop.rating` misafire dukkan sayfasinda ve arama
      sonuclarinda gosterilen sayidir; esnafin pazar yerindeki en gorunur
      isareti. Sessizce eski degerde kalmasi, yeni yorumun hic etkisi olmamasi
      demek.

      Silme yolu (`deleteReviewAction`) ayni islemi ESZAMANLI yapiyordu -- yani
      ayni sayinin guvenilirligi, hangi yoldan gelindigine gore degisiyordu.

      Beklemenin maliyeti tek bir `aggregate` + `update`; yorum yazma zaten bir
      form gonderimi, kullanici o kadarini bekleyebilir. Hata artik YUTULMUYOR:
      cagiran bilsin diye yukari cikiyor.
    */
    await this.updateShopAverageRating(data.shopId);

    return review;
  }

  /**
   * Dükkanın tüm yorumlarını baz alarak ortalama puanı günceller.
   *
   * PUBLIC: `deleteReviewAction` bu gövdenin satır içi bir KOPYASINI taşıyordu
   * (aynı `aggregate`, aynı `update`). Aynı sayıyı iki yerde hesaplamak, bu kod
   * tabanının tekrar tekrar düzelttiği hata sınıfı -- birinin filtresi
   * değiştiğinde diğeri sessizce geride kalır.
   */
  async updateShopAverageRating(shopId: string) {
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
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const reviewService = new ReviewService();
