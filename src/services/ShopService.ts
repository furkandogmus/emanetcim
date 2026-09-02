import type { Prisma, Shop } from '@prisma/client';
import { Role } from '@prisma/client';
import prisma from '@/lib/db';
import { randomUUID } from 'crypto';
import { getStorage, validateImageBytes, buildObjectKey } from '@/lib/storage';
import { getSiteBaseUrl } from "@/lib/site-base-url";
import {
  RESPONSE_TIME_LOOKBACK_DAYS,
  RESPONSE_TIME_MAX_SAMPLES,
  minutesBetween,
  p90Minutes,
} from '@/lib/shop-response-time';
import { moneyToNumber } from '@/lib/money';
import { getActiveShopsOrderedByDistanceKm } from '@/lib/shop-distance-postgis';

import { isShopOpenForStay } from '@/lib/shop-hours';
import { PUBLIC_SHOP_FILTER, OPERATING_SHOP_FILTER } from '@/lib/public-shop-filter';
import { sealService } from "@/services/SealService";
import { notificationService } from '@/services/NotificationService';
import {
  getSlotAvailabilityForShops,
  type SlotAvailability,
} from '@/services/SlotService';
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

/** `HH:MM`, 00:00-23:59. */
const SAAT_BICIMI = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Dukkan guncellemesinin SERVIS SEVIYESINDEKI kapisi.
 *
 * NEDEN VAR (2026-09-02'de gercek veritabaninda olculdu): `updateShop` hicbir
 * dogrulama yapmiyordu ve servis dogrudan cagrildiginda su degerler KAYDA
 * GIRIYORDU --
 *
 *     capacity: -10       -> kaydedildi
 *     pricePerDay: -100   -> kaydedildi
 *     openingTime: "99:99" -> kaydedildi
 *
 * Her biri dukkani farkli bir bicimde bozar:
 *
 *   - NEGATIF KAPASITE dukkani olduruyor: `assertCapacityTx`
 *     `used + newBags > shop.capacity` diye bakiyor, yani ilk valiz bile
 *     sigmiyor ve dukkan hicbir rezervasyon alamiyor. Esnaf sebebini goremez.
 *   - NEGATIF FIYAT, fiyat hesabinin tabanidir; oradan asagisi misafire para
 *     vermek demek.
 *   - GECERSIZ SAAT `isShopOpenForStay`in ayristiramadigi bir deger; acik/kapali
 *     karari belirsizlesir ve check-in tezgahta reddedilebilir.
 *
 * Tasiyicilar zod ile doguruyor (mobil `capacity: z.number().int().min(1)`,
 * web action ayni sekilde), yani bu degerler bugun disaridan gelemez. Ama
 * CLAUDE.md "yazma islemleri yalnizca `src/services/` uzerinden" diyor; son
 * savunma hatti da orasi olmali. Ayni gerekce rezervasyon girdi kapisinda da
 * yazili (`BookingInputInvalidError`).
 */
function assertShopUpdate(data: Partial<Shop>): void {
  if (data.capacity !== undefined) {
    if (!Number.isInteger(data.capacity) || data.capacity < 1) {
      throw new Error('SHOP_INVALID_CAPACITY');
    }
  }
  for (const alan of ['pricePerDay', 'pricePerHour'] as const) {
    const deger = data[alan];
    if (deger === undefined || deger === null) continue;
    const sayi = moneyToNumber(deger);
    if (!Number.isFinite(sayi) || sayi < 0) {
      throw new Error(`SHOP_INVALID_PRICE:${alan}`);
    }
  }
  for (const alan of ['openingTime', 'closingTime'] as const) {
    const deger = data[alan];
    if (deger === undefined || deger === null) continue;
    if (!SAAT_BICIMI.test(deger)) {
      throw new Error(`SHOP_INVALID_HOURS:${alan}`);
    }
  }
}

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
  approveShop(shopId: string): Promise<ApproveShopResult>;
  rejectShop(shopId: string): Promise<RejectShopResult>;
  getShopsByOwner(ownerId: string): Promise<Shop[]>;
  getShopByOwner(ownerId: string): Promise<Shop | null>;
  updateShop(shopId: string, data: Partial<Shop>): Promise<Shop>;
  recomputeResponseTimes(now?: Date): Promise<RecomputeResponseTimesResult>;
}

/**
 * Basvuru reddinin sonucu.
 *
 * Aktif rezervasyonu olan bir dukkan SILINEMEZ: silinirse misafirin elinde
 * karsiligi olmayan bir rezervasyon kalir. Cagirana `throw` yerine sebep
 * donuluyor cunku bu bir HATA degil, gecerli bir "hayir".
 */
export type SetShopImageResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not_found" | "not_owner" | "empty" | "too_large" | "unsupported_type" };

/**
 * Kayitli URL'den nesne anahtarini geri cikarir.
 *
 * URL veritabaninda TAM adres olarak duruyor (misafir tarafi onu dogrudan
 * basiyor). Eski nesneyi silmek icin anahtara ihtiyac var; kok adres eslesmezse
 * -- ornegin CDN alan adi degistiyse -- `null` donuyor ve silme atlaniyor.
 * Yanlis bir anahtari silmeye calismaktansa yetim nesne birakmak yeglenir.
 */
function extractKeyFromUrl(url: string, storage: { publicUrl: (k: string) => string }): string | null {
  const base = storage.publicUrl("");
  return url.startsWith(base) ? url.slice(base.length) : null;
}

/**
 * Onay sonucu.
 *
 * NEDEN `boolean` DEGIL (2026-09-02'de gercek veritabaninda olculdu):
 * koordinati OLMAYAN bir dukkan onaylanabiliyordu ve sonuc sessizdi --
 *
 *     approveShop -> true, isActive: true, koordinat: null
 *     esnafa giden e-posta: "Basvurunuz Onaylandi! 🎉"
 *     500 km yariyapli aramada: GORUNMUYOR
 *
 * Arama tamamen mesafe uzerinden calisiyor (`getActiveShopsOrderedByDistanceKm`),
 * yani koordinatsiz dukkan HICBIR aramada cikmaz. Esnaf onaylandigini
 * biliyor, rezervasyon bekliyor ve neden gelmedigini bilmiyor; admin de bir
 * sey yaptigini sanmiyor cunku islem "basarili" donuyor.
 *
 * `boolean` bu farki tasiyamiyordu: `false` hem "dukkan yok" hem "koordinat
 * yok" demekti. `rejectShop` zaten yapilandirilmis sonuc donuyor; ayni kalip.
 */
export type ApproveShopResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "missing_coordinates" };

export type RejectShopResult =
  | { ok: true; releasedSeals: number }
  | { ok: false; reason: "not_found" | "has_active_bookings" };

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
          /*
            TOPLU MUSAITLIK (2026-08-31'de duzeltildi).

            Bu dongu her dukkan icin ayri ayri `getSlotAvailability` cagiriyordu
            ve o fonksiyon dukkan basina UC sorgu kosuyor. `operating` yuz
            dukkana kadar cikabildigi icin (`take: 100`) TEK BIR ARAMA ISTEGI,
            SIRAYLA, uc yuze varan veritabani gidis-donusu uretiyordu -- sitenin
            en cok trafik alan sayfasinda ve kimlik dogrulamasi olmadan.

            Paralellestirmek yetmezdi: yuz es zamanli sorgu bu sefer baglanti
            havuzunu (`PG_POOL_MAX`, varsayilan 10) doldurur ve diger istekleri
            bekletirdi. Cozum sorgu SAYISINI dusurmek -- artik uc sorgu, kac
            dukkan olursa olsun.
          */
          /*
            HATA YOLU KORUNDU. Onceki dongude her dukkanin cagrisi kendi
            `try`indeydi ve `catch { /* fall through *\/ }` diyordu -- yani slot
            sorgusu patlarsa o dukkan atlaniyor, sonucta hic `hit` cikmazsa
            asagidaki ESKI KAPASITE dalina duşuluyordu. Toplu cagriyi ciplak
            birakmak bu davranisi degistirirdi: tek bir hata butun slot dalini
            oldurup en distaki `catch`e duserdi. Bos `Map` ile devam etmek ayni
            sonucu verir -- `hits` bos kalir, eski dal calisir.
          */
          let availabilityByShop = new Map<string, SlotAvailability[]>();
          try {
            availabilityByShop = await getSlotAvailabilityForShops(
              shopIds,
              checkIn,
              checkOut,
            );
          } catch (err) {
            logger.warn(
              { err, shopCount: shopIds.length },
              "search_slot_availability_batch_failed_using_capacity_fallback",
            );
          }

          const hits: ShopSearchHit[] = [];
          for (const shop of operating) {
            try {
              const slots = availabilityByShop.get(shop.id) ?? [];
              if (slots.length === 0) continue;
              const availableCounts = slots.map((s) => s.available);
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

  /**
   * FILTRESIZ okuma — yalnizca YONETIM yollari icin.
   *
   * Misafire donen hicbir yol bunu cagirmamali: `isTest` ve `isActive`
   * kontrolu YOK. Misafir yuzeyleri `getPublicShopById`, rezervasyon yollari
   * `getOperatingShopById` kullanir.
   */
  async getShopDetails(shopId: string): Promise<Shop | null> {
    return await prisma.shop.findUnique({
      where: { id: shopId }
    });
  }

  /**
   * MISAFIRE GORUNEN dukkan — `PUBLIC_SHOP_FILTER` ile.
   *
   * NEDEN EKLENDI (2026-08-31'de olculdu): "test kaydi kamuya HIC gorunmez"
   * kurali (P1-4) `PUBLIC_SHOP_FILTER` icinde tek yerde yaziliydi, ama kimlikle
   * TEK dukkan okuyan yollarin hicbiri onu kullanmiyordu -- hepsi filtresiz
   * `getShopDetails`i cagiriyordu:
   *
   *   - dukkan sayfasinin `generateMetadata`si: test dukkaninin ADI ve ADRESI
   *     404 donen bir sayfanin `<title>` ve Open Graph alanlarinda cikiyordu
   *   - checkout sayfasi (hem metadata hem govde)
   *   - `/api/mobile/shops/[id]`: mobil detay ucu test dukkanini donduruyordu
   *
   * `public-shop-filter.ts` bunu kelimesi kelimesine ongormustu: "yeni bir
   * cagri yeri eklendiginde biri unutulurdu". Dort cagri yeri eklenmis, dordu
   * de unutulmustu.
   */
  async getPublicShopById(shopId: string): Promise<Shop | null> {
    return await prisma.shop.findFirst({
      where: { id: shopId, ...PUBLIC_SHOP_FILTER },
    });
  }

  /**
   * ISLETILEN dukkan — `OPERATING_SHOP_FILTER` ile. Rezervasyon yollari.
   *
   * `PUBLIC_SHOP_FILTER`dan farki `isPrelaunch: false`. Talep testi noktalari
   * misafire GORUNUR ama isletilmiyorlar: slot uretilmez, muhur beklenmez ve
   * -- `public-shop-filter.ts`in dedigi gibi -- REZERVASYON ALINMAZ.
   *
   * Rezervasyon olusturan yollar bu ayrimi yapmiyordu; yalnizca `isActive`e
   * bakiyorlardi. Yani hem bir TEST dukkanina hem de isletilmeyen bir TALEP
   * TESTI noktasina rezervasyon yapilip PARA alinabiliyordu.
   */
  async getOperatingShopById(shopId: string): Promise<Shop | null> {
    return await prisma.shop.findFirst({
      where: { id: shopId, ...OPERATING_SHOP_FILTER },
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

  async approveShop(shopId: string): Promise<ApproveShopResult> {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: { owner: true },
      });
      if (!shop) return { ok: false, reason: "not_found" };

      /*
        KOORDINATSIZ DUKKAN ONAYLANMAZ.

        Arama tamamen mesafe uzerinden calisiyor
        (`getActiveShopsOrderedByDistanceKm`), yani koordinati olmayan bir
        dukkan HICBIR aramada cikmaz. Onceden onay yine de geciyordu ve olculdu:

          approveShop -> true, isActive: true, koordinat: null
          esnafa giden e-posta: "Basvurunuz Onaylandi! 🎉"
          500 km yariyapli aramada: GORUNMUYOR

        Esnaf onaylandigini biliyor, rezervasyon bekliyor ve neden gelmedigini
        bilmiyor. Admin de bir sey yaptigini saniyor, cunku islem "basarili"
        donuyordu. Sessiz basarisizligi acik hataya cevirmek, onayi engellemek
        pahasina dogru: koordinat girilmeden onay, tutulamayacak bir sozdur.
      */
      if (shop.latitude == null || shop.longitude == null) {
        logger.warn(
          { shopId, name: shop.name },
          "approve_shop_blocked_missing_coordinates",
        );
        return { ok: false, reason: "missing_coordinates" };
      }

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
    /*
      KOK ADRES ORTAK YARDIMCIDAN (2026-08-31). Burasi yedek olarak URETIM alan
      adini SABITLIYORDU (`https://bagajpark.com`): degisken tanimsiz kalan bir
      hazirlik/deneme ortami, test kullanicilarina sessizce uretim baglantilari
      gonderiyordu. Ayrica `NEXT_PUBLIC_BASE_URL`i yok sayiyordu.
    */
      const domain = getSiteBaseUrl();
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

      return { ok: true };
    } catch (error) {
      logger.error({ err: error, shopId }, 'ShopService::approveShop error');
      // Beklenmeyen hata da "onaylanmadi" demek; cagiran ayni yolu izler.
      return { ok: false, reason: "not_found" };
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
    assertShopUpdate(data);
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

  /**
   * Dükkanın vitrin fotoğrafını değiştirir.
   *
   * NEDEN VAR (2026-09-01): `Shop.image` misafir vitrininde çiziliyordu ama
   * kod tabanında ona YAZAN tek bir satır yoktu — ne esnaf panelinde, ne admin
   * formunda, ne seed'de. Yani pazar yerindeki her dükkan kalıcı olarak
   * fotoğrafsızdı ve bunu ürün içinden kimse değiştiremiyordu. Tek engel bir
   * depolama kararıydı; karar S3 olarak verildi (`src/lib/storage/`).
   *
   * ÜÇ ŞEY BU SIRAYLA: sahiplik → görsel doğrulama → yükleme. Yükleme en
   * pahalı adım ve geri alınması en zor olanı; başkasının dükkanı için ya da
   * görsel olmayan bir dosya için S3'e yazmak istemeyiz.
   */
  async setShopImage(params: {
    shopId: string;
    actorId: string;
    actorRole: Role;
    bytes: Uint8Array;
  }): Promise<SetShopImageResult> {
    const { shopId, actorId, actorRole, bytes } = params;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { ownerId: true, image: true },
    });
    if (!shop) return { ok: false, reason: "not_found" };
    // Admin sahiplik kontrolunu atlar; bu bir ALAN kurali, rol kapisi degil.
    if (shop.ownerId !== actorId && actorRole !== Role.ADMIN) {
      return { ok: false, reason: "not_owner" };
    }

    const validation = validateImageBytes(bytes);
    if (!validation.ok) return { ok: false, reason: validation.reason };

    const storage = getStorage();
    const key = buildObjectKey({
      prefix: "shops",
      ownerId: shopId,
      uniqueId: randomUUID(),
      extension: validation.extension,
    });
    const { url } = await storage.put({
      key,
      body: bytes,
      contentType: validation.contentType,
    });

    await prisma.shop.update({ where: { id: shopId }, data: { image: url } });

    /*
      ESKI NESNE SONRA SILINIR ve hatasi YUTULUR: veritabani zaten yeni adresi
      gosteriyor, yani kullanici acisindan is bitti. Silme basarisiz olursa
      kovada yetim bir nesne kalir -- rahatsiz edici ama zararsiz. Once silip
      sonra yazmak ise, yazma basarisiz oldugunda dukkani fotografsiz birakirdi.
    */
    const previousKey = shop.image ? extractKeyFromUrl(shop.image, storage) : null;
    if (previousKey && previousKey !== key) {
      void storage
        .remove(previousKey)
        .catch((err: unknown) => logger.warn({ err, shopId, previousKey }, "shop_image_cleanup_failed"));
    }

    return { ok: true, url };
  }

  /**
   * Esnaf basvurusunu REDDET (dukkani sil) -- iki tasiyicinin ortak govdesi.
   *
   * NEDEN SERVISE TASINDI (2026-09-01'de olculdu): red iki yerde AYRI AYRI
   * yazilmisti ve kopyalar farkli sekilde eksikti:
   *
   *   web  (`rejectShopAction`)      : siliyor, aktif rezervasyonu ONCEDEN
   *                                    kontrol etmiyor (FK ihlaline guveniyor)
   *                                    ve MUHURLERI STOGA DONDURMUYOR
   *   mobil (`api/admin/applications`): aktif rezervasyonu sayiyor ve muhurleri
   *                                    donduruyor
   *
   * Yani hangi ekrandan reddedildigine gore muhurler ya stoga donuyor ya da
   * silinmis bir dukkana ATANMIS halde askida kaliyordu -- envanter sessizce
   * eksiliyordu. CLAUDE.md'deki kural bu: bir is kurali iki tasiyicida ayri
   * yazilmaz.
   *
   * FK ihlaline GUVENILMIYOR: rezervasyon `onDelete` davranisina gore silme
   * basarili da olabilir, ve o durumda misafirin elinde karsiligi olmayan bir
   * rezervasyon kalirdi. Kontrol acikca yapiliyor.
   */
  async rejectShop(shopId: string): Promise<RejectShopResult> {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });
    if (!shop) return { ok: false, reason: "not_found" };

    const activeBookingCount = await prisma.booking.count({
      where: { shopId, status: { in: ["APPROVED", "PAID", "CHECKED_IN"] } },
    });
    if (activeBookingCount > 0) {
      return { ok: false, reason: "has_active_bookings" };
    }

    await prisma.shop.delete({ where: { id: shopId } });

    /*
      Muhur envanteri `SealService`in isi. Ham `seal.updateMany` yazmak, ayni
      islemin baska bir yerde farkli yazilmasi demek -- envanter o zaman ayrisir.
    */
    const releasedSeals = await sealService.releaseShopSeals(shopId);
    return { ok: true, releasedSeals };
  }
}

// Singleton instances for KISS principle
export const shopService = new ShopService();
