import { Booking, BookingStatus } from '@prisma/client';
import prisma from '@/lib/db';

/**
 * BookingRepository - SOLID: Dependency Inversion
 * Veritabanı (Prisma) ile doğrudan konuşan katman.
 */
export class BookingRepository {
  /**
   * Yeni bir rezervasyon kaydı oluşturur.
   */
  async create(data: {
    guestId: string;
    shopId: string;
    totalPrice: number;
    bagCountS: number;
    bagCountM: number;
    bagCountXl: number;
    qrCodeToken: string;
    status: BookingStatus;
    checkInTime: Date;
    checkOutTime: Date;
  }): Promise<Booking> {
    return await prisma.booking.create({
      data: {
        ...data
      }
    });
  }

  /**
   * Rezervasyonu ID bazlı getirir.
   */
  async findById(id: string): Promise<Booking | null> {
    return await prisma.booking.findUnique({
      where: { id },
      include: {
        shop: true,
        guest: true
      }
    });
  }

  /**
   * Rezervasyon durumunu günceller.
   */
  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: { status }
    });
  }
}

export const bookingRepository = new BookingRepository();

