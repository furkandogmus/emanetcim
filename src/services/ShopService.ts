import type { Prisma, Shop } from '@prisma/client';
import { Role } from '@prisma/client';
import prisma from '@/lib/db';
import { moneyToNumber } from '@/lib/money';
import { getActiveShopsOrderedByDistanceKm } from '@/lib/shop-distance-postgis';

import { isShopOpenAt } from '@/lib/shop-hours';
import { notificationService } from '@/services/NotificationService';
import logger from '@/lib/logger';

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
  getShopByOwner(ownerId: string): Promise<Shop | null>;
  updateShop(shopId: string, data: Partial<Shop>): Promise<Shop>;
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
        take: 100,
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
        take: 100,
      });

      const withDist: ShopWithDistance[] = pairs.map(({ shop, distanceKm }) => ({
        ...shop,
        pricePerDay: moneyToNumber(shop.pricePerDay),
        distanceKm,
      }));

      if (withDist.length === 0) return [];

      const shopIds = withDist.map((s) => s.id);

      const aggregations = await prisma.booking.groupBy({
        by: ['shopId'],
        where: {
          shopId: { in: shopIds },
          status: { in: [...BOOKING_STATUSES_FOR_CAPACITY] },
          AND: [
            { checkInTime: { lt: checkOut } },
            { checkOutTime: { gt: checkIn } },
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

      // Partner'a onay bildirimi gönder
      const partnerEmail = shop.owner?.email;
      const partnerPhone = shop.owner?.phone;
      const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://bagajpark.com';
      if (partnerEmail) {
        void notificationService.sendEmail(
          partnerEmail,
          'BagajPark: Başvurunuz Onaylandı! 🎉',
          `Merhaba ${shop.owner?.name ?? 'Esnaf'},\n\n${shop.name} mağazanız BagajPark platformuna kabul edildi!\n\nHemen giriş yaparak rezervasyonları yönetebilirsiniz:\n${domain}/tr/partner`,
          undefined,
          `<div style=”font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px”>
            <h2 style=”color:#ea580c”>Başvurunuz Onaylandı! 🎉</h2>
            <p>Merhaba <strong>${shop.owner?.name ?? 'Esnaf'}</strong>,</p>
            <p><strong>${shop.name}</strong> mağazanız BagajPark platformuna kabul edildi. Artık rezervasyon almaya başlayabilirsiniz!</p>
            <a href=”${domain}/tr/partner” style=”display:inline-block;background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0”>Partner Panelime Git</a>
            <p style=”font-size:13px;color:#6b7280;margin-top:24px”>BagajPark — Güvenli Bagaj Emaneti</p>
          </div>`
        ).catch((e) => logger.warn({ err: e, shopId }, 'shop_approval_email_failed'));
      }
      if (partnerPhone) {
        void notificationService.sendSms(
          partnerPhone,
          `BagajPark: ${shop.name} mağazanız onaylandı! Hemen giriş yapın: ${domain}/tr/partner`
        ).catch((e) => logger.warn({ err: e, shopId }, 'shop_approval_sms_failed'));
      }

      return true;
    } catch (error) {
      logger.error({ err: error, shopId }, 'ShopService::approveShop error');
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
}

// Singleton instances for KISS principle
export const shopService = new ShopService();
