import prisma from '@/lib/db';
import { distanceKm } from '@/lib/geo';

export interface IShopService {
  findNearby(latitude: number, longitude: number, radiusInKm: number): Promise<any[]>;
  getShopDetails(shopId: string): Promise<any | null>;
  getPendingShops(): Promise<any[]>;
  approveShop(shopId: string): Promise<boolean>;
  getShopsByOwner(ownerId: string): Promise<any[]>;
}

/**
 * ShopService - SOLID: Single Responsibility
 */
export class ShopService implements IShopService {
  async findNearby(latitude: number, longitude: number, radiusInKm: number, page: number = 1, limit: number = 10): Promise<any[]> {
    try {
      const shops = await prisma.shop.findMany({
        where: { isActive: true },
      });
      const withDist = shops
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          ...s,
          distanceKm: distanceKm(latitude, longitude, s.latitude!, s.longitude!),
        }))
        .filter((s) => s.distanceKm <= radiusInKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      const skip = (page - 1) * limit;
      return withDist.slice(skip, skip + limit);
    } catch (error) {
      console.error('ShopService::findNearby Error:', error);
      return [];
    }
  }

  async getShopDetails(shopId: string): Promise<any | null> {
    return await prisma.shop.findUnique({
      where: { id: shopId }
    });
  }

  async getPendingShops(): Promise<any[]> {
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

  async getShopsByOwner(ownerId: string): Promise<any[]> {
    return await prisma.shop.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

// Singleton instances for KISS principle
export const shopService = new ShopService();
