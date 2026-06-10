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

  async updateStatus(serialNumber: number, status: SealStatus): Promise<Seal> {
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
