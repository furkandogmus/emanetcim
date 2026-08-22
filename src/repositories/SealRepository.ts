import type { Seal, SealStatus, BookingSeal } from '@prisma/client';
import prisma from '@/lib/db';

export class SealRepository {
  async findById(serialNumber: number): Promise<Seal | null> {
    return prisma.seal.findUnique({ where: { serialNumber } });
  }

  async findManyByShopId(shopId: string): Promise<Seal[]> {
    return prisma.seal.findMany({ where: { shopId } });
  }

  async findAvailableByShopId(shopId: string, limit: number): Promise<Seal[]> {
    return prisma.seal.findMany({
      where: { shopId, status: 'ASSIGNED' },
      take: limit,
      orderBy: { serialNumber: 'asc' },
    });
  }

  async countByStatus(status: SealStatus): Promise<number> {
    return prisma.seal.count({ where: { status } });
  }

  async countByShopIdAndStatus(shopId: string, status: SealStatus): Promise<number> {
    return prisma.seal.count({ where: { shopId, status } });
  }

  async createMany(serialNumbers: number[], shopId?: string): Promise<{ count: number }> {
    return prisma.seal.createMany({
      data: serialNumbers.map((sn) => ({
        serialNumber: sn,
        shopId: shopId ?? null,
        status: 'STOCK' as SealStatus,
      })),
    });
  }

  /**
   * Mühür durumunu değiştirir ve SAHİPLİK DEĞİŞMEZİNİ korur.
   *
   * Eski hâli `shopId`'ye hiç dokunmadan herhangi bir durumu yazıyordu ve
   * prod'daki 1.247 "sahipsiz ASSIGNED" mührün kaynağı buydu (P1-7). Artık:
   *   - `STOCK`'a dönen mühür dükkandan çıkar (`shopId = null`).
   *   - `STOCK` dışına çıkan mühür bir dükkana ait olmalı; değilse hata verir.
   *
   * DB'de aynı kural `Seal_ownership_matches_status` kısıtıyla da zorlanıyor —
   * burası daha iyi bir hata mesajı için, tek savunma hattı değil.
   */
  async updateStatus(serialNumber: number, status: SealStatus): Promise<Seal> {
    if (status === 'STOCK') {
      return prisma.seal.update({
        where: { serialNumber },
        data: { status, shopId: null, assignedAt: null },
      });
    }

    const current = await prisma.seal.findUnique({
      where: { serialNumber },
      select: { shopId: true },
    });
    if (!current) {
      throw new Error(`seal_not_found: ${serialNumber}`);
    }
    if (!current.shopId) {
      throw new Error(
        `seal_not_owned_by_shop: ${serialNumber} bir dükkana ait değilken ${status} yapılamaz`,
      );
    }

    return prisma.seal.update({
      where: { serialNumber },
      data: { status },
    });
  }

  async assignToShop(serialNumbers: number[], shopId: string): Promise<void> {
    await prisma.seal.updateMany({
      where: { serialNumber: { in: serialNumbers }, status: 'STOCK' },
      data: { shopId, status: 'ASSIGNED', assignedAt: new Date() },
    });
  }

  async findBookingSealsByBookingId(bookingId: string): Promise<BookingSeal[]> {
    return prisma.bookingSeal.findMany({
      where: { bookingId },
      orderBy: { bagIndex: 'asc' },
    });
  }
}

export const sealRepository = new SealRepository();
