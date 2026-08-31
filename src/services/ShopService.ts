import type { Prisma, Shop } from '@prisma/client';
import { Role } from '@prisma/client';
import prisma from '@/lib/db';
import {
  RESPONSE_TIME_LOOKBACK_DAYS,
  RESPONSE_TIME_MAX_SAMPLES,
  minutesBetween,
  p90Minutes,
} from '@/lib/shop-response-time';
import { moneyToNumber } from '@/lib/money';
import { getActiveShopsOrderedByDistanceKm } from '@/lib/shop-distance-postgis';

import { isShopOpenForStay } from '@/lib/shop-hours';
import { PUBLIC_SHOP_FILTER } from '@/lib/public-shop-filter';
import { notificationService } from '@/services/NotificationService';
import { getSlotAvailability } from '@/services/SlotService';
import logger from '@/lib/logger';
import { renderEmailHtml } from '@/lib/email-template';

/**
 * `recomputeResponseTimes` içinde `null`'a çekilecek dükkanlar tek seferde değil,
 * bu boyutta öbeklerle yazılır — tek bir dev `IN (...)` listesi üretmemek için.
 */
const RESPONSE_TIME_CLEAR_BATCH = 500;

export type ShopWithDistance = {
  id: string;
  ownerId: string;
  name: string;
  address: string | null;
  image: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  isActive: boolean;
  rating: number | null;
  pricePerDay: number;
  pricePerHour: number;
  hasRestroom: boolean;
  hasCctv: boolean;
  hasClimateControl: boolean;
  acceptsLargeItems: boolean;
  open247: boolean;
  openingTime: string | null;
  closingTime: string | null;
  createdAt: Date;
  updatedAt: Date;
  city: string | null;
  district: string | null;
  sealLeadTimeDays: number;
  sealReorderPoint: number;
  isVerified: boolean;
  responseTimeMinutes: number | null;
  timezone: string | null;
  distanceKm: number;
  /**
   * Talep testi noktası. Aramada GÖRÜNÜR, rezervasyon ALMAZ.
   *
   * Arama sonucuna kadar taşınması şart: bu noktalar müsaitlik üretmiyor, o
   * yüzden `findShopsForSearch` onları ayrı ele almak zorunda; arayüz de fiyat
   * yerine "Yakında" çizebilmek için bunu bilmek zorunda.
   */
  isPrelaunch: boolean;
};

/** Arama: seçilen pencerede kalan valiz kapasitesi (tahmini). */
export type ShopSearchHit = ShopWithDistance & {
  bagsAvailable: number;
  _score?: number;
};

/**
 * Sıralamada kullanılan puan skoru (0-1).
 *
 * NEDEN AYRI (P2-2, 2026-08-24): iki çağrı yerinde de `(shop.rating ?? 3) / 5`
 * yazıyordu, yani "puanı yoksa nötr 3 varsay". Ama `Shop.rating` şema
 * varsayılanı `0.0` — `NULL` DEĞİL. `??` hiç devreye girmiyor ve HENÜZ YORUM
 * ALMAMIŞ her dükkan puan bileşeninden sıfır alıyor. Bugün üç dükkan da 0
 * olduğu için sıralama görünürde doğru; ilk yorum geldiği anda o dükkan
 * diğerlerinin önüne 0.3'lük bir farkla geçer — nötr varsayım hiç çalışmamış olur.
 *
 * Düzeltme kolonu değil YORUMU okuyor: puan 0 ise "değerlendirilmemiş" demektir
 * (yıldız arayüzü de `rating > 0` ile zaten böyle davranıyor), o yüzden nötr
 * varsayım uygulanır. Kolonun `NULL`'a çevrilmesi ayrı bir veri kararıdır;
 * bu satır her iki durumda da doğru sonucu verir.
 */
const NEUTRAL_RATING = 3;

function ratingScore(rating: number | null | undefined): number {
  const r = rating ?? 0;
  return (r > 0 ? r : NEUTRAL_RATING) / 5;
}

function toShopWithDistance(shop: Shop, distanceKm: number): ShopWithDistance {
  return {
    id: shop.id,
    ownerId: shop.ownerId,
    name: shop.name,
    address: shop.address,
    image: shop.image,
    description: shop.description,
    latitude: shop.latitude,
    longitude: shop.longitude,
    capacity: shop.capacity,
    isActive: shop.isActive,
    rating: shop.rating,
    pricePerDay: moneyToNumber(shop.pricePerDay),
    pricePerHour: moneyToNumber(shop.pricePerHour ?? shop.pricePerDay),
    hasRestroom: shop.hasRestroom,
    hasCctv: shop.hasCctv,
    hasClimateControl: shop.hasClimateControl,
    acceptsLargeItems: shop.acceptsLargeItems,
    open247: shop.open247,
    openingTime: shop.openingTime,
    closingTime: shop.closingTime,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt,
    city: shop.city,
    district: shop.district,
    sealLeadTimeDays: shop.sealLeadTimeDays,
    sealReorderPoint: shop.sealReorderPoint,
    isVerified: shop.isVerified,
    responseTimeMinutes: shop.responseTimeMinutes,
    timezone: shop.timezone ?? null,
    distanceKm,
    isPrelaunch: shop.isPrelaunch,
  };
}

export type ShopWithOwner = Prisma.ShopGetPayload<{
  include: { owner: true };
}>;

export type ShopPublicDetail = Prisma.ShopGetPayload<{
  include: {
    reviews: { include: { guest: { select: { name: true } } } };
  };
}>;

export type RecomputeResponseTimesResult = {
  /** Değer yazılan dükkan sayısı (yeterli örneği olanlar). */
  updated: number;
  /** Örneği yetersiz olduğu için `null`'a çekilen dükkan sayısı. */
  cleared: number;
  /** Hesaba giren toplam onay örneği. */
  samples: number;
  /**
   * GERÇEKTEN veritabanına yazılan satır sayısı.
   *
   * `updated + cleared`'dan küçüktür: değeri değişmeyen dükkan yazılmaz. Sıfıra
   * yakın bir `written`, işin boşa dönmediğinin değil, platformun oturduğunun
   * işaretidir.
   */
  written: number;
};

export type FindShopsForSearchOptions = {
  centerLat: number;
  centerLng: number;
  /** null = tüm Türkiye listesi (mesafeye göre sıralı), sayı = yarıçap km */
  radiusKm: number | null;
  checkIn: Date;
  checkOut: Date;
  requestedBags: number;
};

export interface IShopService {
  findNearby(
    latitude: number,
    longitude: number,
    radiusInKm: number,
    page?: number,
    limit?: number
  ): Promise<ShopWithDistance[]>;
  getAllActive(latitude: number, longitude: number): Promise<ShopWithDistance[]>;
  /** Tarih aralığı + valiz sayısına göre müsait dükkanlar (kapasite + çalışma saati). */
  findShopsForSearch(options: FindShopsForSearchOptions): Promise<ShopSearchHit[]>;
  getShopDetails(shopId: string): Promise<Shop | null>;
  /** Misafir detay sayfası: aktif dükkan + son yorumlar */
  getShopPublicDetail(shopId: string): Promise<ShopPublicDetail | null>;
  getShopImages(shopId: string): Promise<Array<{ id: string; url: string; order: number }>>;
  getPendingShops(): Promise<ShopWithOwner[]>;
  approveShop(shopId: string): Promise<boolean>;
  getShopsByOwner(ownerId: string): Promise<Shop[]>;
  getShopByOwner(ownerId: string): Promise<Shop | null>;
  updateShop(shopId: string, data: Partial<Shop>): Promise<Shop>;
  recomputeResponseTimes(now?: Date): Promise<RecomputeResponseTimesResult>;
}

/**
 * ShopService - SOLID: Single Responsibility
 */
export class ShopService implements IShopService {
  async findNearby(
    latitude: number,
    longitude: number,
    radiusInKm: number,
    page: number = 1,
    limit: number = 10
  ): Promise<ShopWithDistance[]> {
    try {
      const skip = (page - 1) * limit;
      const pairs = await getActiveShopsOrderedByDistanceKm({
        centerLat: latitude,
        centerLng: longitude,
        radiusKm: radiusInKm,
        skip,
        take: limit,
      });
      return pairs.map(({ shop, distanceKm }) =>
        toShopWithDistance(shop, distanceKm),
      );
    } catch (error) {
      console.error('ShopService::findNearby Error:', error);
      return [];
    }
  }

  async getAllActive(
    latitude: number,
    longitude: number
  ): Promise<ShopWithDistance[]> {
    try {
      const pairs = await getActiveShopsOrderedByDistanceKm({
        centerLat: latitude,
        centerLng: longitude,
        radiusKm: null,
        take: 100,
      });
      return pairs.map(({ shop, distanceKm }) =>
        toShopWithDistance(shop, distanceKm),
      );
    } catch (error) {
      console.error('ShopService::getAllActive Error:', error);
      return [];
    }
  }

  /**
   * Çakışan rezervasyonlardaki valiz adetlerini toplu hesaplar; kapasite ve çalışma saatine göre süzer.
   */
  async findShopsForSearch(
    options: FindShopsForSearchOptions
  ): Promise<ShopSearchHit[]> {
    const {
      centerLat,
      centerLng,
      radiusKm,
      checkIn,
      checkOut,
      requestedBags,
    } = options;
    const bags = Math.max(1, Math.floor(requestedBags));

    try {
        const pairs = await getActiveShopsOrderedByDistanceKm({
          centerLat,
          centerLng,
          radiusKm,
          take: 100,
        });
        const withDist: ShopWithDistance[] = pairs.map(({ shop, distanceKm }) =>
          toShopWithDistance(shop, distanceKm),
        );

        if (withDist.length === 0) return [];

        /**
         * TALEP TESTİ NOKTALARI MÜSAİTLİK KAPISINDAN GEÇMEZ.
         *
         * Bu noktalar tanım gereği slot ÜRETMEZ (`OPERATING_SHOP_FILTER` onları
         * slot üretiminin dışında tutuyor) ve varsayılan 09:00–20:00 saatleri
         * gerçek bir çalışma saati değil. Aşağıdaki iki süzgeç de bu yüzden
         * onları eliyordu: slot dalında `slots.length === 0` ile, eski dalda
         * `isShopOpenForStay` ile. Sonuç 2026-08-31'de üretimde ölçüldü —
         * İstanbul'da 10 nokta yazılıyken arama "TÜM NOKTALAR (3)" diyordu,
         * yani talep testinin TAMAMI görünmezdi ve ölçmek istediğimiz tıklama
         * hiç gerçekleşemezdi.
         *
         * Ayrı bir listede toplanıyorlar, çünkü:
         *   - Eski dala düşme kararı YALNIZCA işletilen dükkanlara bakmalı;
         *     yoksa bir prelaunch noktası `hits`i doldurup, slot tablosu boş
         *     olduğunda gerçek dükkanların kapasite yedeğine düşmesini engeller.
         *   - Sıralamada rezervasyon ALABİLEN dükkan her zaman önce gelir;
         *     misafire önce gidip valizini bırakabileceği yer gösterilir.
         */
        const operating = withDist.filter((s) => !s.isPrelaunch);
        const prelaunchHits: ShopSearchHit[] = withDist
          .filter((s) => s.isPrelaunch)
          .map((shop) => ({
            ...shop,
            // 0 değil, "bilinmiyor": kart müsaitlik rozetini hiç çizmemeli,
            // çünkü burada ölçülecek bir kapasite yok.
            bagsAvailable: 0,
            _score:
              (1 - Math.min(1, shop.distanceKm / 20)) * 0.5 +
              ratingScore(shop.rating) * 0.3,
          }))
          .sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

        if (operating.length === 0) return prelaunchHits;

        const shopIds = operating.map((s) => s.id);

        // Try slot-based availability first (more accurate for short stays)
        const stayHours = (checkOut.getTime() - checkIn.getTime()) / 3600000;

        if (stayHours <= 48) {
          const hits: ShopSearchHit[] = [];
          for (const shop of operating) {
            try {
              const slots = await getSlotAvailability(shop.id, checkIn, checkOut);
              if (slots.length === 0) continue;
              const availableCounts = slots.map((s: { available: number }) => s.available);
              if (availableCounts.length === 0) continue;
              const minAvailable = Math.min(...availableCounts);
              if (minAvailable < bags) continue;

              const openOk = isShopOpenForStay(
                shop.openingTime,
                shop.closingTime,
                shop.open247,
                checkIn,
                checkOut,
                shop.timezone ?? "Europe/Istanbul",
              );
              if (!openOk) continue;

              const distScore = 1 - Math.min(1, shop.distanceKm / 20);
              const rScore = ratingScore(shop.rating);
              const availScore = Math.min(1, minAvailable / Math.max(10, shop.capacity));
              const score = distScore * 0.5 + rScore * 0.3 + availScore * 0.2;

              hits.push({ ...shop, bagsAvailable: minAvailable, _score: score });
            } catch {
              // Fall through
            }
          }
          if (hits.length > 0) {
            hits.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
            return [...hits, ...prelaunchHits];
          }
        }

        // Legacy capacity check (fallback for long stays or when slots are unavailable)
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const pendingStatuses = ['WAITING_APPROVAL', 'APPROVED', 'PENDING'] as const;
        const reservedStatuses = ['PAID', 'CHECKED_IN'] as const;

        const aggregations = await prisma.booking.groupBy({
          by: ['shopId'],
          where: {
            shopId: { in: shopIds },
            AND: [
              { checkInTime: { lt: checkOut } },
              { checkOutTime: { gt: checkIn } },
            ],
            OR: [
              { status: { in: [...reservedStatuses] } },
              {
                status: { in: [...pendingStatuses] },
                checkInTime: { gt: staleThreshold },
              },
            ],
          },
          _sum: {
            bagCountS: true,
            bagCountM: true,
            bagCountXl: true,
          },
        });
 
        const usedByShop = new Map<string, number>();
        for (const agg of aggregations) {
          const n = 
            (agg._sum.bagCountS || 0) + 
            (agg._sum.bagCountM || 0) + 
            (agg._sum.bagCountXl || 0);
          usedByShop.set(agg.shopId, n);
        }

        const hits: ShopSearchHit[] = [];

        for (const shop of operating) {
          const used = usedByShop.get(shop.id) ?? 0;
          const bagsAvailable = Math.max(0, shop.capacity - used);
          if (bagsAvailable < bags) continue;

          const openOk = isShopOpenForStay(
            shop.openingTime,
            shop.closingTime,
            shop.open247,
            checkIn,
            checkOut,
            shop.timezone ?? "Europe/Istanbul",
          );
          if (!openOk) continue;

          // Weighted score: 50% distance + 30% rating + 20% availability
          const distScore = 1 - Math.min(1, shop.distanceKm / 20);
          const rScore = ratingScore(shop.rating);
          const availScore = Math.min(1, bagsAvailable / Math.max(10, shop.capacity));
          const score = distScore * 0.5 + rScore * 0.3 + availScore * 0.2;

          hits.push({ ...shop, bagsAvailable, _score: score });
        }

        // Sort by weighted score (desc), then fallback to distance
        hits.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
        return [...hits, ...prelaunchHits];
    } catch (error) {
      console.error('ShopService::findShopsForSearch Error:', error);
      return [];
    }
  }

  async getShopDetails(shopId: string): Promise<Shop | null> {
    return await prisma.shop.findUnique({
      where: { id: shopId }
    });
  }

  async getShopPublicDetail(shopId: string): Promise<ShopPublicDetail | null> {
    /*
      PUBLIC_SHOP_FILTER, elle `isActive: true` DEGIL.

      P1-4'un kurali "isTest kaydi kamuya HIC gorunmez" ama duzeltme yalnizca
      arama, listeler ve istatistikleri kapsamisti; DETAY SAYFASI disarida
      kalmisti. Yani bir test dukkani aramada gorunmuyor, ama URL'i bilen
      (ya da eski bir bagi olan) herkes sayfasini aciyordu. Filtreyi tek yerde
      tutmanin sebebi tam olarak buydu: dorduncu bir cagri yeri eklendiginde
      biri unutuluyor.

      Prelaunch noktalari BU FILTREDEN GECER -- gorunmeleri gerekiyor, olculen
      sey o.
    */
    return prisma.shop.findFirst({
      where: { id: shopId, ...PUBLIC_SHOP_FILTER },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 40,
          include: {
            guest: { select: { name: true } },
          },
        },
      },
    });
  }

  async getShopImages(shopId: string) {
    return prisma.$queryRawUnsafe<Array<{ id: string; url: string; order: number }>>(
      `SELECT id, url, "order" FROM "ShopImage" WHERE "shopId" = $1 ORDER BY "order" ASC LIMIT 20`,
      shopId
    );
  }

  async getPendingShops(): Promise<ShopWithOwner[]> {
    return await prisma.shop.findMany({
      where: { isActive: false },
      include: { owner: true }
    });
  }

  async approveShop(shopId: string): Promise<boolean> {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: { owner: true },
      });
      if (!shop) return false;

      await prisma.$transaction(async (tx) => {
        await tx.shop.update({
          where: { id: shopId },
          data: { isActive: true },
        });
        // Eski kayıtlar: esnaf e-postası doğrulanmamış olabilir; onayla birlikte “operasyonel” say.
        await tx.user.updateMany({
          where: {
            id: shop.ownerId,
            role: Role.PARTNER,
            email: { not: null },
            emailVerified: null,
          },
          data: { emailVerified: new Date() },
        });
      });

      /**
       * Partner'a onay bildirimi.
       *
       * ESKİDEN SESSİZCE ATLANIYORDU: `if (partnerEmail)` koşulu, e-postası olmayan
       * partner için hiçbir iz bırakmadan geçiliyordu. Prod'daki 3 PARTNER hesabının
       * 2'sinin e-postası yok ve ikisi de canlı bir dükkan sahibi — yani onay
       * maili hiç gitmedi ve kimse fark etmedi. SMS dalı çalıştığı için sorun
       * görünmez kaldı (P1-3).
       *
       * Artık atlanan her kanal loglanıyor ve HİÇBİR kanal yoksa bu bir UYARI:
       * onaylanmış ama ulaşılamayan bir partner operasyonel bir açıktır.
       */
      const partnerEmail = shop.owner?.email;
      const partnerPhone = shop.owner?.phone;
      const partnerName = shop.owner?.name ?? 'Esnaf';
      const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://bagajpark.com';
      const panelUrl = `${domain}/tr/partner`;

      if (partnerEmail) {
        void notificationService.sendEmail(
          partnerEmail,
          'BagajPark: Başvurunuz Onaylandı! 🎉',
          `Merhaba ${partnerName},\n\n${shop.name} mağazanız BagajPark platformuna kabul edildi!\n\nHemen giriş yaparak rezervasyonları yönetebilirsiniz:\n${panelUrl}`,
          undefined,
          /*
            Kabuk `renderEmailHtml`'te. Buradaki HTML elle yaziliyordu ve bir kez
            KIVRIK TIRNAK ile yazilmisti — hicbir `style`/`href` ozniteligi gecerli
            degildi, e-posta stilsiz gidiyor ve buton bir yere baglanmiyordu (P1-3).
            Markup artik tek yerde; o hatanin tekrari icin bir yuzey kalmadi.
          */
          renderEmailHtml({
            locale: 'tr',
            heading: 'Başvurunuz Onaylandı! 🎉',
            paragraphs: [
              `Merhaba <strong>${partnerName}</strong>,`,
              `<strong>${shop.name}</strong> mağazanız BagajPark platformuna kabul edildi. Artık rezervasyon almaya başlayabilirsiniz!`,
            ],
            cta: { href: panelUrl, label: 'Partner Panelime Git', variant: 'button' },
            footer: 'BagajPark — Güvenli Bagaj Emaneti',
          })
        ).catch((e) => logger.warn({ err: e, shopId }, 'shop_approval_email_failed'));
      } else {
        logger.warn(
          { shopId, ownerId: shop.ownerId },
          'shop_approval_email_skipped_no_address',
        );
      }

      if (partnerPhone) {
        void notificationService.sendSms(
          partnerPhone,
          `BagajPark: ${shop.name} mağazanız onaylandı! Hemen giriş yapın: ${panelUrl}`
        ).catch((e) => logger.warn({ err: e, shopId }, 'shop_approval_sms_failed'));
      } else {
        logger.warn(
          { shopId, ownerId: shop.ownerId },
          'shop_approval_sms_skipped_no_phone',
        );
      }

      if (!partnerEmail && !partnerPhone) {
        // Onaylanmış ama ulaşılamayan partner: dükkan rezervasyon almaya başlıyor
        // ama sahibi bundan haberdar edilemiyor.
        logger.error(
          { shopId, ownerId: shop.ownerId },
          'shop_approved_but_partner_unreachable',
        );
      }

      return true;
    } catch (error) {
      logger.error({ err: error, shopId }, 'ShopService::approveShop error');
      return false;
    }
  }

  /**
   * Bekleyen başvuruyu reddeder: bağlı rezervasyon yoksa dükkan kaydını siler.
   *
   * `error` alanı ham Türkçe metin değil `"Errors.x"` anahtarı döner — arayüz
   * `useTranslations("Errors")` ile çevirmeden göstermemeli (bkz. `RejectButton.tsx`).
   */
  async rejectPendingShop(shopId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return { ok: false, error: 'Errors.shopNotFound' };
      if (shop.isActive) {
        return { ok: false, error: 'Errors.shopAlreadyApproved' };
      }
      const bookingCount = await prisma.booking.count({ where: { shopId } });
      if (bookingCount > 0) {
        return {
          ok: false,
          error: 'Errors.shopHasBookings',
        };
      }
      await prisma.shop.delete({ where: { id: shopId } });
      return { ok: true };
    } catch (error) {
      console.error('ShopService::rejectPendingShop Error:', error);
      return { ok: false, error: 'Errors.generic' };
    }
  }

  async getShopsByOwner(ownerId: string): Promise<Shop[]> {
    return await prisma.shop.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getShopByOwner(ownerId: string): Promise<Shop | null> {
    return await prisma.shop.findFirst({
      where: { ownerId },
    });
  }

  async updateShop(shopId: string, data: Partial<Shop>): Promise<Shop> {
    return await prisma.shop.update({
      where: { id: shopId },
      data,
    });
  }

  /**
   * "Yanıt süresi" rozetini GERÇEK veriden yeniden hesaplar (P2-7).
   *
   * Ölçüm: misafirin talebi oluşturduğu an (`Booking.createdAt`) ile esnafın
   * onay verdiği an (`BookingEvent` `APPROVED`) arası. Yeterli örneği olmayan
   * dükkanın değeri `null`'a çekilir — rozet o zaman hiç çizilmez. Uydurulmuş
   * bir sayı, gösterilmeyen bir rozetten daha kötüdür.
   *
   * İDEMPOTENT: yalnızca okuyup yazar, olay üretmez; tekrar çalıştırmak zararsız.
   */
  async recomputeResponseTimes(
    now: Date = new Date(),
  ): Promise<RecomputeResponseTimesResult> {
    const since = new Date(
      now.getTime() - RESPONSE_TIME_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );

    const events = await prisma.bookingEvent.findMany({
      where: { event: 'APPROVED', createdAt: { gte: since } },
      select: { bookingId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    /*
      MEVCUT DEĞER DE OKUNUYOR: aşağıdaki döngü yalnızca DEĞİŞEN satırı yazsın
      diye. Aynı sorgu, ek maliyet yok.
    */
    const shops = await prisma.shop.findMany({
      select: { id: true, responseTimeMinutes: true },
    });
    const stored = new Map(shops.map((s) => [s.id, s.responseTimeMinutes]));
    const byShop = new Map<string, number[]>(shops.map((s) => [s.id, []]));

    if (events.length > 0) {
      const bookings = await prisma.booking.findMany({
        where: { id: { in: events.map((e) => e.bookingId) } },
        select: { id: true, shopId: true, createdAt: true },
      });
      const bookingById = new Map(bookings.map((b) => [b.id, b]));

      for (const ev of events) {
        const booking = bookingById.get(ev.bookingId);
        if (!booking) continue;
        const bucket = byShop.get(booking.shopId);
        if (!bucket || bucket.length >= RESPONSE_TIME_MAX_SAMPLES) continue;
        const minutes = minutesBetween(booking.createdAt, ev.createdAt);
        // Negatif fark yalnızca saat sapmasından çıkar; örnek olarak sayılmaz.
        if (minutes < 0) continue;
        bucket.push(minutes);
      }
    }

    let updated = 0;
    let cleared = 0;
    let samples = 0;
    let written = 0;

    /*
      YALNIZCA DEĞİŞENİ YAZ (performans).

      Eskiden bu döngü, dükkan başına BİR `UPDATE` atıyordu — sırayla, yani
      dükkan sayısı × gidiş-dönüş süresi. Üstelik dükkanların ezici çoğunluğunun
      yeterli örneği hiç olmuyor: onlar için hesap her gece `null` çıkıyor ve
      zaten `null` olan satır tekrar `null` yazılıyordu. Yani işin yaptığı
      yazmaların neredeyse tamamı hiçbir şeyi değiştirmiyordu, ama havuzdan bir
      bağlantıyı dükkan sayısıyla orantılı süre boyunca tutuyordu.

      Şimdi: değişmeyen satır atlanır, `null`'a çekilecekler tek `updateMany` ile
      toplu yazılır. Geriye yalnızca gerçekten yeni bir değer kazanan avuç dolusu
      dükkan için tekil `UPDATE` kalır.

      `updated`/`cleared` ANLAMI DEĞİŞMEDİ — hâlâ "sonuçta değeri olan / `null`
      olan dükkan sayısı"dır, "yazılan" değil. Çağıran (`/api/internal/
      response-times` → iş defteri) bu sayıları böyle okuyor. Gerçek yazma
      sayısı ayrı bir alan: `written`.
    */
    const toClear: string[] = [];

    for (const [shopId, values] of byShop) {
      samples += values.length;
      const value = p90Minutes(values);
      if (value === null) cleared += 1;
      else updated += 1;

      if (stored.get(shopId) === value) continue;

      if (value === null) {
        toClear.push(shopId);
      } else {
        await prisma.shop.update({
          where: { id: shopId },
          data: { responseTimeMinutes: value },
        });
        written += 1;
      }
    }

    /*
      Parça parça: `responseTimeMinutes` şemada `@default(0)`, yani HİÇ
      çalışmamış bir veritabanında ilk koşu tüm dükkanları temizler. Tek bir dev
      `IN (...)` listesi üretmemek için 500'lük öbekler.
    */
    for (let i = 0; i < toClear.length; i += RESPONSE_TIME_CLEAR_BATCH) {
      const batch = toClear.slice(i, i + RESPONSE_TIME_CLEAR_BATCH);
      await prisma.shop.updateMany({
        where: { id: { in: batch } },
        data: { responseTimeMinutes: null },
      });
      written += batch.length;
    }

    return { updated, cleared, samples, written };
  }
}

// Singleton instances for KISS principle
export const shopService = new ShopService();
