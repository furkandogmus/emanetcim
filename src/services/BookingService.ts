import { Booking, Prisma } from '@prisma/client';
import prisma from '@/lib/db';

export type CreateInitialBookingInput = {
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
};

export type BookingWithGuestShop = Prisma.BookingGetPayload<{
  include: { guest: true; shop: true };
}>;

export type BookingWithShopGuestDetails = Prisma.BookingGetPayload<{
  include: { shop: true; guest: true };
}>;

export type GuestBookingListItem = Prisma.BookingGetPayload<{
  include: { shop: true; dispute: true };
}>;

export type PartnerBookingListItem = Prisma.BookingGetPayload<{
  include: { guest: true };
}>;
import { createQrToken } from '@/lib/qr-token';
import { isRefundSuccess } from '@/lib/payment-status';
import logger from '@/lib/logger';
import { isShopOpenAt } from '@/lib/shop-hours';
import { totalBagCount } from '@/lib/bag-pricing';
import { getPricingRules } from '@/lib/platform-settings';
import { moneyToNumber } from '@/lib/money';
import type {
  PartnerCheckInResult,
  PartnerCheckOutResult,
  CancelBookingResult,
} from '@/types/partner-booking';

type TxClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>;

export class BookingCapacityExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingCapacityExceededError';
  }
}

export interface IBookingService {
  checkIn(bookingId: string, sealPhotoUrl: string): Promise<PartnerCheckInResult>;
  checkOut(bookingId: string): Promise<PartnerCheckOutResult>;
  getBookingByToken(token: string): Promise<BookingWithGuestShop | null>;
  createInitialBooking(data: CreateInitialBookingInput): Promise<Booking>;
  getUserBookings(userId: string): Promise<GuestBookingListItem[]>;
  getPartnerBookings(shopId: string): Promise<PartnerBookingListItem[]>;
  getBookingDetails(id: string): Promise<BookingWithShopGuestDetails | null>;
  cancelBooking(bookingId: string): Promise<CancelBookingResult>;
  markAsPaid(bookingId: string): Promise<void>;
}

/**
 * BookingService - Emanetçi Operasyonel ve Finansal Yönetim Servisi
 */
export class BookingService implements IBookingService {
  /**
   * Misafir için ilk rezervasyonu oluşturur.
   */
  async createInitialBooking(data: CreateInitialBookingInput): Promise<Booking> {
    const rules = await getPricingRules();
    return prisma.$transaction(
      async (tx) => {
        const shop = await tx.shop.findUnique({ where: { id: data.shopId } });
        if (!shop) {
          throw new Error('Dükkan bulunamadı.');
        }
        await tx.$executeRawUnsafe(
          `SELECT 1 FROM "Shop" WHERE id = $1::uuid FOR UPDATE`,
          data.shopId
        );

        const unitPrice =
          typeof data.unitPrice === 'number' && Number.isFinite(data.unitPrice)
            ? data.unitPrice
            : moneyToNumber(shop.pricePerDay) || rules.defaultPricePerDay;
        const insuranceFee =
          typeof data.insuranceFee === 'number' && Number.isFinite(data.insuranceFee)
            ? Math.max(0, data.insuranceFee)
            : 0;

        const newBags = totalBagCount(
          data.bagCountS,
          data.bagCountM,
          data.bagCountXl
        );
        await this.assertCapacityTx(
          tx,
          shop,
          data.shopId,
          data.checkInTime,
          data.checkOutTime,
          newBags
        );

        const booking = await tx.booking.create({
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

        return tx.booking.update({
          where: { id: booking.id },
          data: { qrCodeToken },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async assertCapacityTx(
    tx: TxClient,
    shop: { capacity: number },
    shopId: string,
    checkInTime: Date,
    checkOutTime: Date,
    newBags: number
  ): Promise<void> {
    const overlapping = await tx.booking.findMany({
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
      const pricingRules = await getPricingRules();
      const { pricingService } = await import('./PricingService');
      const refundAmount = pricingService.calculateEarlyRefund(
        booking,
        now,
        pricingRules
      );

      if (refundAmount > 0) {
        const { paymentService } = await import('@/services/PaymentService');
        const refundResult = await paymentService.refundPayment(
          bookingId,
          refundAmount
        );

        if (!isRefundSuccess(refundResult.status)) {
          console.error('Early check-out refund failed:', refundResult);
          return {
            ok: false,
            code: 'REFUND_FAILED',
            message:
              'Erken teslimat iadesi şu an tamamlanamadı. Lütfen tekrar deneyin veya destek ile iletişime geçin.',
          };
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

  async getBookingByToken(token: string): Promise<BookingWithGuestShop | null> {
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

  async getBookingDetails(id: string): Promise<BookingWithShopGuestDetails | null> {
    return await prisma.booking.findUnique({
      where: { id },
      include: { shop: true, guest: true }
    });
  }

  async getUserBookings(userId: string): Promise<GuestBookingListItem[]> {
    return await prisma.booking.findMany({
      where: { guestId: userId },
      include: { shop: true, dispute: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPartnerBookings(shopId: string): Promise<PartnerBookingListItem[]> {
    return await prisma.booking.findMany({
      where: { shopId },
      include: { guest: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Rezervasyon İptali ve İade Süreci
   * PAID iken iade başarısızsa rezervasyon CANCELLED yapılmaz (finansal tutarlılık).
   */
  async cancelBooking(bookingId: string): Promise<CancelBookingResult> {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      return { ok: false, code: 'NOT_FOUND', message: 'Rezervasyon bulunamadı.' };
    }
    if (
      booking.status === 'CANCELLED' ||
      booking.status === 'CHECKED_IN' ||
      booking.status === 'CHECKED_OUT'
    ) {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: 'Bu rezervasyon iptal edilemez.',
      };
    }

    try {
      const rules = await getPricingRules();
      if (booking.status === 'PAID') {
        const insuranceFee = moneyToNumber(booking.insuranceFee);
        const serviceBase = Math.max(0, moneyToNumber(booking.totalPrice) - insuranceFee);
        const refundAmount = Math.max(
          0,
          serviceBase - rules.cancelFixedFeeTry
        );
        const { paymentService } = await import('@/services/PaymentService');
        if (refundAmount > 0) {
          const refundResult = await paymentService.refundPayment(bookingId, refundAmount);
          if (!isRefundSuccess(refundResult?.status)) {
            logger.error(
              { bookingId, refundAmount, status: refundResult?.status },
              'cancelBooking_refund_failed',
            );
            return {
              ok: false,
              code: 'REFUND_FAILED',
              message:
                'İade şu an tamamlanamadı. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.',
            };
          }
        }
      }

      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      return { ok: true };
    } catch (error) {
      logger.error({ err: error, bookingId }, 'BookingService::cancelBooking');
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'İptal sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }
}

export const bookingService = new BookingService();
