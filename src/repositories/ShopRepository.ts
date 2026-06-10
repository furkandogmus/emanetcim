import type { Shop } from '@prisma/client';
import prisma from '@/lib/db';

export class ShopRepository {
  async findById(id: string): Promise<Shop | null> {
    return prisma.shop.findUnique({ where: { id } });
  }

  async findActiveById(id: string): Promise<Shop | null> {
    return prisma.shop.findFirst({ where: { id, isActive: true } });
  }

  async findManyByIds(ids: string[]): Promise<Shop[]> {
    return prisma.shop.findMany({ where: { id: { in: ids } } });
  }

  async findByOwnerId(ownerId: string): Promise<Shop | null> {
    return prisma.shop.findFirst({ where: { ownerId } });
  }

  async findManyByOwnerId(ownerId: string): Promise<Shop[]> {
    return prisma.shop.findMany({ where: { ownerId } });
  }

  async findPendingShops(): Promise<Shop[]> {
    return prisma.shop.findMany({ where: { isActive: false } });
  }

  async update(id: string, data: Partial<Shop>): Promise<Shop> {
    return prisma.shop.update({ where: { id }, data });
  }

  async approve(id: string): Promise<Shop> {
    return prisma.shop.update({ where: { id }, data: { isActive: true } });
  }
}

export const shopRepository = new ShopRepository();
