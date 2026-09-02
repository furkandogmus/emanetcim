import prisma from "@/lib/db";

/**
 * ReviewService - Misafir yorumlarını ve dükkan puanlarını yönetir.
 * UC_M_11 kapsamında 1-5 yıldız puanlama desteği.
 */
/**
 * Yorum metninin ust siniri.
 *
 * Dukkan sayfasi elli yorum cekiyor; sinirsiz metin orada birikiyor. Iki bin
 * karakter, bir misafirin anlatmak isteyecegi her seyi rahatca aliyor.
 */
export const MAX_REVIEW_COMMENT_LENGTH = 2000;

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
    /*
      PUAN VE YORUM SINIRLARI SERVISTE (2026-09-02'de gercek veritabaninda
      olculdu). Servis dogrudan cagrildiginda sunlar kaydediliyordu:

          puan  10  -> kaydedildi
          puan  -3  -> kaydedildi
          puan   0  -> kaydedildi
          50.000 karakterlik yorum -> kaydedildi

      Sonucta dukkanin ortalamasi 3.5'e dustu ve 5'IN USTUNE de cikabilirdi.
      Bu yalnizca bir rozet degil: `ShopService.ratingScore` arama SIRALAMASINI
      besliyor ve `(r > 0 ? r : 3) / 5` ile normalize ediyor -- puan 10 olan bir
      dukkan oradan 2.0 aliyor, yani 0-1 arasi olmasi gereken bilesende iki kat
      agirlik kazaniyor. Tek bir hatali puan siralamayi bozar.

      Iki tasiyici da 1-5 doguruyordu AMA AYNI SEKILDE DEGIL: web
      `Number.isInteger` ile 4.7'yi reddediyor, mobil `Math.round` ile 5'e
      yuvarliyordu. Ayni girdi iki tasiyicida iki farkli sonuc veriyordu; kural
      artik tek yerde.

      YORUM UZUNLUGU HICBIR YERDE SINIRLI DEGILDI. `getShopReviews` elli yorum
      cekiyor; elli tane elli bin karakterlik yorum iki buçuk megabaytlik bir
      dukkan sayfasi demek.
    */
    if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
      throw new Error("REVIEW_INVALID_RATING");
    }
    if (data.comment != null && data.comment.length > MAX_REVIEW_COMMENT_LENGTH) {
      throw new Error("REVIEW_COMMENT_TOO_LONG");
    }
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
