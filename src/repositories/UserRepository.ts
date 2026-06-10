import type { User } from '@prisma/client';
import prisma from '@/lib/db';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { phone } });
  }

  async findManyByIds(ids: string[]): Promise<User[]> {
    return prisma.user.findMany({ where: { id: { in: ids } } });
  }

  async create(data: {
    email?: string;
    phone?: string;
    name?: string;
    role?: 'GUEST' | 'PARTNER' | 'ADMIN';
  }): Promise<User> {
    return prisma.user.create({ data: { ...data, role: data.role ?? 'GUEST' } });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  async ban(id: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { isBanned: true } });
  }

  async unban(id: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { isBanned: false } });
  }
}

export const userRepository = new UserRepository();
