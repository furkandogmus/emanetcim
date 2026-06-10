import type { NotificationLog } from '@prisma/client';
import prisma from '@/lib/db';

export class NotificationLogRepository {
  async create(data: {
    bookingId?: string;
    type: string;
    recipient: string;
    subject?: string;
    content: string;
    status: string;
    error?: string;
  }): Promise<NotificationLog> {
    return prisma.notificationLog.create({ data });
  }

  async findByBookingId(bookingId: string): Promise<NotificationLog[]> {
    return prisma.notificationLog.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecentByRecipient(recipient: string, limit = 20): Promise<NotificationLog[]> {
    return prisma.notificationLog.findMany({
      where: { recipient },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const notificationLogRepository = new NotificationLogRepository();
