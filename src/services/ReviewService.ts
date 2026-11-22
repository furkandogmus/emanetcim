import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { cursorArgs, toPage } from "@/lib/cursor-page";
import { VISIBLE_REVIEW } from "@/lib/review-visibility";

/** "Dusuk puan" moderasyon filtresi: 1-2 yildiz. */
export const LOW_RATING_MAX = 2;

export type AdminReviewFilter = "all" | "low" | "hidden";

/** `?filter=` okuma; bilinmeyen deger `all`. */
export function parseAdminReviewFilter(raw: string | null | undefined): AdminReviewFilter {
  return raw === "low" || raw === "hidden" ? raw : "all";
}

export type ModerationActor = { id: string; ip?: string | null };

export type ModerateReviewResult =
  | { ok: true; shopId: string; rating: number }
  | { ok: false; reason: "not_found" | "already_hidden" | "not_hidden" | "reason_required" };

/** Gizleme/silme gerekcesinin siniri; denetim kaydinda tasinir. */
export const MAX_MODERATION_REASON = 300;

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
  async updateShopAverageRating(shopId: string, db: Prisma.TransactionClient = prisma) {
    const aggregations = await db.review.aggregate({
      where: { shopId, ...VISIBLE_REVIEW },
      _avg: { rating: true },
      _count: { id: true }
    });

    await db.shop.update({
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
      where: { shopId, ...VISIBLE_REVIEW },
      include: {
        guest: {
          select: { name: true, image: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Sayfali yorum listesi + gercek toplam. `getShopReviews` 50'de kesiyordu ve
   * toplam donmuyordu: mobil baslik "Yorumlar (50)" yazip bes yorum gosteriyordu.
   */
  async listShopReviews(shopId: string, opts: { cursor?: string | null; take?: number } = {}) {
    const take = Math.min(Math.max(1, opts.take ?? 20), 50);
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where: { shopId, ...VISIBLE_REVIEW },
        include: { guest: { select: { name: true, image: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...cursorArgs(opts.cursor ?? null, take),
      }),
      prisma.review.count({ where: { shopId, ...VISIBLE_REVIEW } }),
    ]);
    return { ...toPage(rows, take), total };
  }

  /**
   * Yonetici moderasyon listesi: gizlenenler DAHIL (filtre `hidden` yalnizca
   * onlari gosterir). `shopId` verilirse o dukkanin yorumlari, verilmezse
   * platformun son yorumlari.
   */
  async listForAdmin(
    opts: { shopId?: string | null; filter?: AdminReviewFilter; cursor?: string | null; take?: number } = {},
  ) {
    const take = Math.min(Math.max(1, opts.take ?? 20), 50);
    const where: Prisma.ReviewWhereInput = {
      ...(opts.shopId ? { shopId: opts.shopId } : {}),
      ...(opts.filter === "low" ? { rating: { lte: LOW_RATING_MAX } } : {}),
      ...(opts.filter === "hidden" ? { hiddenAt: { not: null } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          guest: { select: { name: true } },
          shop: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...cursorArgs(opts.cursor ?? null, take),
      }),
      prisma.review.count({ where }),
    ]);
    return { ...toPage(rows, take), total };
  }

  /**
   * Yonetici moderasyonu -- gizle / geri al / sil. Web (`deleteReviewAction`) ve
   * mobil admin ucu AYNI govdeden gecer: yazma, ortalamanin yeniden hesabi ve
   * denetim kaydi burada. Ortalama BEKLENIR (`addReview` ile ayni gerekce):
   * gizlenen tek yildizli yorum dukkanin puanini asagida tutmaya devam etmesin.
   *
   * Gerekce gizlemede zorunlu (geri almayi yapacak kisi nedenini gormeli);
   * silmede tasiyiciya birakilir, verilirse denetim kaydina girer.
   */
  async moderate(params: {
    reviewId: string;
    action: "hide" | "unhide" | "delete";
    reason?: string | null;
    actor: ModerationActor;
  }): Promise<ModerateReviewResult> {
    const reason = params.reason?.trim().slice(0, MAX_MODERATION_REASON) || null;
    if (params.action === "hide" && !reason) return { ok: false, reason: "reason_required" };

    // Denetim kaydi icin anlik goruntu; yazma kosulu asagida, bu okumaya guvenmez.
    const review = await prisma.review.findUnique({
      where: { id: params.reviewId },
      select: { id: true, shopId: true, rating: true, comment: true, guestId: true },
    });
    if (!review) return { ok: false, reason: "not_found" };

    /*
      KOSULLU YAZMA + AYNI ISLEM (QA, 2026-11-23): once okuyup sonra yazmak iki
      yoneticinin ayni anda silmesinde P2025 -> 500, ayni anda gizlemesinde iki
      "basarili" ve iki denetim kaydi uretiyordu. Kosul satir kilidiyle yeniden
      degerlendirilir; ikinci istek 0 satir gorur ve alan hatasi doner. Ortalama
      ayni islemde: yazma geri alinirsa puan da eski kalir.
    */
    const id = review.id;
    const written = await prisma.$transaction(async (tx) => {
      const { count } =
        params.action === "delete"
          ? await tx.review.deleteMany({ where: { id } })
          : params.action === "hide"
            ? await tx.review.updateMany({
                where: { id, hiddenAt: null },
                data: { hiddenAt: new Date(), hiddenReason: reason, hiddenById: params.actor.id },
              })
            : await tx.review.updateMany({
                where: { id, hiddenAt: { not: null } },
                data: { hiddenAt: null, hiddenReason: null, hiddenById: null },
              });
      if (count === 0) return false;
      await this.updateShopAverageRating(review.shopId, tx);
      return true;
    });

    if (!written) {
      if (params.action === "delete") return { ok: false, reason: "not_found" };
      // Kosul tutmadi: ya biri az once sildi, ya da durum zaten istenen gibi.
      const still = await prisma.review.findUnique({ where: { id }, select: { id: true } });
      if (!still) return { ok: false, reason: "not_found" };
      return { ok: false, reason: params.action === "hide" ? "already_hidden" : "not_hidden" };
    }

    writeAuditLog({
      actorUserId: params.actor.id,
      actorRole: "ADMIN",
      action: `admin.review.${params.action}`,
      entityType: "Review",
      entityId: review.id,
      metadata: {
        shopId: review.shopId,
        guestId: review.guestId,
        rating: review.rating,
        reason,
        // Silinen yorumun izi yalnizca burada kalir; kisaltilmis metin yeter.
        ...(params.action === "delete" && review.comment ? { comment: review.comment.slice(0, 200) } : {}),
      },
      ip: params.actor.ip ?? null,
    });

    return { ok: true, shopId: review.shopId, rating: review.rating };
  }
}

export const reviewService = new ReviewService();
