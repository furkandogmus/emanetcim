import type { Prisma, Shop } from '@prisma/client';
import prisma from '@/lib/db';
import { moneyToNumber } from '@/lib/money';
import { getActiveShopsOrderedByDistanceKm } from '@/lib/shop-distance-postgis';
import { totalBagCount } from '@/lib/bag-pricing';
import { isShopOpenAt } from '@/lib/shop-hours';

export type ShopWithDistance = Omit<Shop, 'pricePerDay'> & {
  pricePerDay: number;
  distanceKm: number;
};

/** Arama: seçilen pencerede kalan valiz kapasitesi (tahmini). */
export type ShopSearchHit = ShopWithDistance & {
  bagsAvailable: number;
};

const BOOKING_STATUSES_FOR_CAPACITY = [
  'WAITING_APPROVAL',
  'APPROVED',
  'PENDING',
  'PAID',
  'CHECKED_IN',
] as const;

export type ShopWithOwner = Prisma.ShopGetPayload<{
  include: { owner: true };
}>;

export type ShopPublicDetail = Prisma.ShopGetPayload<{
  include: {
    reviews: { include: { guest: { select: { name: true } } } };
  };
}>;

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
  getPendingShops(): Promise<ShopWithOwner[]>;
  approveShop(shopId: string): Promise<boolean>;
  getShopsByOwner(ownerId: string): Promise<Shop[]>;
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
      return pairs.map(({ shop, distanceKm }) => ({
        ...shop,
        pricePerDay: moneyToNumber(shop.pricePerDay),
        distanceKm,
      }));
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
        take: null,
      });
      return pairs.map(({ shop, distanceKm }) => ({
        ...shop,
        pricePerDay: moneyToNumber(shop.pricePerDay),
        distanceKm,
      }));
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
        take: null,
      });

      const withDist: ShopWithDistance[] = pairs.map(({ shop, distanceKm }) => ({
        ...shop,
        pricePerDay: moneyToNumber(shop.pricePerDay),
        distanceKm,
      }));

      if (withDist.length === 0) return [];

      const shopIds = withDist.map((s) => s.id);

      const overlapping = await prisma.booking.findMany({
        where: {
          shopId: { in: shopIds },
          status: { in: [...BOOKING_STATUSES_FOR_CAPACITY] },
          AND: [
            { checkInTime: { lt: checkOut } },
            { checkOutTime: { gt: checkIn } },
          ],
        },
        select: {
          shopId: true,
          bagCountS: true,
          bagCountM: true,
          bagCountXl: true,
        },
      });

      const usedByShop = new Map<string, number>();
      for (const b of overlapping) {
        const n =
          totalBagCount(b.bagCountS, b.bagCountM, b.bagCountXl);
        usedByShop.set(b.shopId, (usedByShop.get(b.shopId) ?? 0) + n);
      }

      const hits: ShopSearchHit[] = [];

      for (const shop of withDist) {
        const used = usedByShop.get(shop.id) ?? 0;
        const bagsAvailable = Math.max(0, shop.capacity - used);
        if (bagsAvailable < bags) continue;

        const openOk =
          shop.open247 ||
          (isShopOpenAt(shop.openingTime, shop.closingTime, checkIn) &&
            isShopOpenAt(shop.openingTime, shop.closingTime, checkOut));
        if (!openOk) continue;

        hits.push({ ...shop, bagsAvailable });
      }

      return hits;
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
    return prisma.shop.findFirst({
      where: { id: shopId, isActive: true },
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

  async getPendingShops(): Promise<ShopWithOwner[]> {
    return await prisma.shop.findMany({
      where: { isActive: false },
      include: { owner: true }
    });
  }

  async approveShop(shopId: string): Promise<boolean> {
    try {
      await prisma.shop.update({
        where: { id: shopId },
        data: { isActive: true }
      });
      return true;
    } catch (error) {
      console.error('ShopService::approveShop Error:', error);
      return false;
    }
  }

  /**
   * Bekleyen başvuruyu reddeder: bağlı rezervasyon yoksa dükkan kaydını siler.
   */
  async rejectPendingShop(shopId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return { ok: false, error: 'Dükkan bulunamadı.' };
      if (shop.isActive) {
        return { ok: false, error: 'Onaylı dükkan reddedilemez.' };
      }
      const bookingCount = await prisma.booking.count({ where: { shopId } });
      if (bookingCount > 0) {
        return {
          ok: false,
          error: 'Bu dükkan için rezervasyon kaydı var; silinemez.',
        };
      }
      await prisma.shop.delete({ where: { id: shopId } });
      return { ok: true };
    } catch (error) {
      console.error('ShopService::rejectPendingShop Error:', error);
      return { ok: false, error: 'Red işlemi başarısız.' };
    }
  }

  async getShopsByOwner(ownerId: string): Promise<Shop[]> {
    return await prisma.shop.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

// Singleton instances for KISS principle
export const shopService = new ShopService();
