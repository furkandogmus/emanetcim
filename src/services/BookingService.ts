import { Booking } from '@prisma/client';
import prisma from '@/lib/db';
import { createQrToken } from '@/lib/qr-token';
import { isRefundSuccess } from '@/lib/payment-status';
import { isShopOpenAt } from '@/lib/shop-hours';
import { totalBagCount } from '@/lib/bag-pricing';
import type {
  PartnerCheckInResult,
  PartnerCheckOutResult,
} from '@/types/partner-booking';

export class BookingCapacityExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingCapacityExceededError';
  }
}

export interface IBookingService {
  checkIn(bookingId: string, sealPhotoUrl: string): Promise<PartnerCheckInResult>;
  checkOut(bookingId: string): Promise<PartnerCheckOutResult>;
  getBookingByToken(token: string): Promise<any>;
  createInitialBooking(data: any): Promise<Booking>;
  getUserBookings(userId: string): Promise<any[]>;
  getPartnerBookings(shopId: string): Promise<any[]>;
  getBookingDetails(id: string): Promise<any>;
  cancelBooking(bookingId: string): Promise<boolean>;
  markAsPaid(bookingId: string): Promise<void>;
}

/**
 * BookingService - Emanetçi Operasyonel ve Finansal Yönetim Servisi
 */
export class BookingService implements IBookingService {
  /**
   * Misafir için ilk rezervasyonu oluşturur.
   */
  async createInitialBooking(data: {
    guestId: string;
    shopId: string;
    totalPrice: number;
    bagCountS: number;
    bagCountM: number;
    bagCountXl: number;
    checkInTime: Date;
    checkOutTime: Date;
    unitPrice?: number;
    insuranceFee?: number;
  }): Promise<Booking> {
    const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) {
      throw new Error('Dükkan bulunamadı.');
    }
    const unitPrice = data.unitPrice || shop?.pricePerDay || 50;
    const insuranceFee =
      typeof data.insuranceFee === 'number' && Number.isFinite(data.insuranceFee)
        ? Math.max(0, data.insuranceFee)
        : 0;

    const newBags = totalBagCount(
      data.bagCountS,
      data.bagCountM,
      data.bagCountXl
    );
    await this.assertCapacity(
      shop,
      data.shopId,
      data.checkInTime,
      data.checkOutTime,
      newBags
    );

    const booking = await prisma.booking.create({
      data: {
        guestId: data.guestId,
        shopId: data.shopId,
        totalPrice: data.totalPrice,
        insuranceFee,
        bagCountS: data.bagCountS,
        bagCountM: data.bagCountM,
        bagCountXl: data.bagCountXl,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        unitPrice,
        qrCodeToken: `temp_${crypto.randomUUID()}`,
        status: 'PENDING',
      },
    });

    const qrCodeToken = await createQrToken({
      bookingId: booking.id,
      guestId: data.guestId,
      shopId: data.shopId,
    });

    return prisma.booking.update({
      where: { id: booking.id },
      data: { qrCodeToken },
    });
  }

  private async assertCapacity(
    shop: { capacity: number },
    shopId: string,
    checkInTime: Date,
    checkOutTime: Date,
    newBags: number
  ): Promise<void> {
    const overlapping = await prisma.booking.findMany({
      where: {
        shopId,
        status: { in: ['PENDING', 'PAID', 'CHECKED_IN'] },
        AND: [
          { checkInTime: { lt: checkOutTime } },
          { checkOutTime: { gt: checkInTime } },
        ],
      },
      select: { bagCountS: true, bagCountM: true, bagCountXl: true },
    });

    const used = overlapping.reduce(
      (sum, b) => sum + totalBagCount(b.bagCountS, b.bagCountM, b.bagCountXl),
      0
    );

    if (used + newBags > shop.capacity) {
      const remaining = Math.max(0, shop.capacity - used);
      throw new BookingCapacityExceededError(
        `Bu tarih aralığında dükkan kapasitesi yetersiz (kalan: ${remaining} valiz, talep: ${newBags}).`
      );
    }
  }

  /**
   * Valizin mühürle teslim alınması (Check-in).
   */
  async checkIn(bookingId: string, sealPhotoUrl: string): Promise<PartnerCheckInResult> {
    try {
      const existing = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { shop: true },
      });
      if (!existing) {
        return {
          ok: false,
          code: 'NOT_FOUND',
          message: 'Rezervasyon bulunamadı.',
        };
      }
      if (existing.status !== 'PAID') {
        return {
          ok: false,
          code: 'INVALID_STATUS',
          message: `Check-in için ödeme tamamlanmış olmalı (durum: ${existing.status}).`,
        };
      }
      if (
        !isShopOpenAt(
          existing.shop.openingTime,
          existing.shop.closingTime,
          new Date()
        )
      ) {
        console.warn('BookingService::checkIn: dükkan kapalı saat aralığında');
        return {
          ok: false,
          code: 'SHOP_CLOSED',
          message:
            'Şu an dükkan kapalı görünüyor. Çalışma saatleri içinde tekrar deneyin.',
        };
      }

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CHECKED_IN',
          sealPhotoUrl: sealPhotoUrl,
          updatedAt: new Date(),
        },
      });
      return { ok: true };
    } catch (error) {
      console.error('BookingService::checkIn Error:', error);
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Check-in sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }

  /**
   * Valizin teslim edilmesi (Check-out) + Erken Teslimat İadesi.
   */
  async checkOut(bookingId: string): Promise<PartnerCheckOutResult> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Rezervasyon bulunamadı.',
      };
    }
    if (booking.status !== 'CHECKED_IN') {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: `Teslim için valiz önce dükkana alınmış olmalı (durum: ${booking.status}).`,
      };
    }

    try {
      const now = new Date();

      // 1. Erken Teslimat İadesi Hesabı (UC_E_06_EXTRA)
      const { pricingService } = await import('./PricingService');
      const refundAmount = pricingService.calculateEarlyRefund(booking, now);

      if (refundAmount > 0) {
        const { paymentService } = await import('./PaymentService');
        const refundResult = await paymentService.refundPayment(
          bookingId,
          refundAmount
        );

        if (!isRefundSuccess(refundResult.status)) {
          console.error('Early check-out refund failed:', refundResult);
        }
      }

      // 2. Statüyü CHECKED_OUT yap ve zamanı mühürle
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CHECKED_OUT',
          checkOutTime: now,
          updatedAt: now,
        },
      });

      return { ok: true };
    } catch (error) {
      console.error('BookingService::checkOut Error:', error);
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Teslim sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }

  async getBookingByToken(token: string): Promise<any> {
    const { verifyQrToken } = await import('@/lib/qr-token');
    const payload = await verifyQrToken(token);
    if (payload) {
      const booking = await prisma.booking.findUnique({
        where: { id: payload.bookingId },
        include: { guest: true, shop: true },
      });
      if (booking && booking.qrCodeToken === token) return booking;
    }
    return prisma.booking.findUnique({
      where: { qrCodeToken: token },
      include: { guest: true, shop: true },
    });
  }

  async markAsPaid(bookingId: string): Promise<void> {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'PAID' }
    });
  }

  async getBookingDetails(id: string): Promise<any> {
    return await prisma.booking.findUnique({
      where: { id },
      include: { shop: true, guest: true }
    });
  }

  async getUserBookings(userId: string): Promise<any[]> {
    return await prisma.booking.findMany({
      where: { guestId: userId },
      include: { shop: true, dispute: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPartnerBookings(shopId: string): Promise<any[]> {
    return await prisma.booking.findMany({
      where: { shopId },
      include: { guest: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Rezervasyon İptali ve İade Süreci
   */
  async cancelBooking(bookingId: string): Promise<boolean> {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.status === 'CANCELLED' || booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') {
      return false;
    }

    try {
      if (booking.status === 'PAID') {
        const insuranceFee = booking.insuranceFee ?? 0;
        const serviceBase = Math.max(0, booking.totalPrice - insuranceFee);
        const refundAmount = Math.max(0, serviceBase - 20); // 20 TL Sabit Kesinti (hizmet bedeli)
        const { paymentService } = await import('./PaymentService');
        await paymentService.refundPayment(bookingId, refundAmount);
      }

      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' }
      });

      return true;
    } catch (error) {
      console.error('BookingService::cancelBooking Error:', error);
      return false;
    }
  }
}

export const bookingService = new BookingService();
