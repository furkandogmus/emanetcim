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

export type ModifyBookingInput = {
  checkInTime: Date;
  checkOutTime: Date;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
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
import { sealService, type SealAssignmentInput } from '@/services/SealService';
import { getPricingRules } from '@/lib/platform-settings';
import { moneyToNumber } from '@/lib/money';
import type {
  PartnerCheckInResult,
  PartnerCheckOutResult,
  CancelBookingResult,
  ModifyBookingResult,
} from '@/types/partner-booking';
import {
  computeAuthoritativeCheckoutTotals,
  validateBookingStayWindow,
} from '@/lib/booking-server-price';
import {
  estimatePaidRefundForTier,
  getCancellationTier,
} from '@/lib/cancellation-policy';

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

export type CheckInSealPayload = {
  sealAssignments: SealAssignmentInput[];
  faultySealNumbers: number[];
};

export interface IBookingService {
  checkIn(
    bookingId: string,
    sealPhotoUrl: string | null,
    sealPayload?: CheckInSealPayload
  ): Promise<PartnerCheckInResult>;
  checkOut(bookingId: string): Promise<PartnerCheckOutResult>;
  getBookingByToken(token: string): Promise<BookingWithGuestShop | null>;
  createInitialBooking(data: CreateInitialBookingInput): Promise<Booking>;
  getUserBookings(userId: string): Promise<GuestBookingListItem[]>;
  getPartnerBookings(shopId: string): Promise<PartnerBookingListItem[]>;
  getBookingDetails(id: string): Promise<BookingWithShopGuestDetails | null>;
  cancelBooking(bookingId: string): Promise<CancelBookingResult>;
  markAsPaid(bookingId: string): Promise<void>;
  modifyBooking(
    bookingId: string,
    guestId: string,
    input: ModifyBookingInput
  ): Promise<ModifyBookingResult>;
}

/**
 * BookingService - BagajPark Operasyonel ve Finansal Yönetim Servisi
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
          newBags,
          undefined
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
    newBags: number,
    excludeBookingId?: string
  ): Promise<void> {
    const overlapping = await tx.booking.findMany({
      where: {
        shopId,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        status: {
          in: [
            'WAITING_APPROVAL',
            'APPROVED',
            'PENDING',
            'PAID',
            'CHECKED_IN',
          ],
        },
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
   * En az bir valiz varsa mühür atamaları zorunludur (platform stokundan ASSIGNED mühürler).
   */
  async checkIn(
    bookingId: string,
    sealPhotoUrl: string | null,
    sealPayload?: CheckInSealPayload
  ): Promise<PartnerCheckInResult> {
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
      if (existing.status !== 'PAID' && (existing.status as string) !== 'APPROVED') {
        return {
          ok: false,
          code: 'INVALID_STATUS',
          message: `Check-in için onaylanmış veya ödenmiş olmalı (durum: ${existing.status}).`,
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

      const bags = totalBagCount(
        existing.bagCountS,
        existing.bagCountM,
        existing.bagCountXl
      );

      if (bags > 0) {
        if (
          !sealPayload?.sealAssignments?.length ||
          sealPayload.sealAssignments.length !== bags
        ) {
          return {
            ok: false,
            code: 'SEAL_COUNT_MISMATCH',
            message:
              'Her valiz için kayıtlı bir mühür numarası gerekir. Atamaları kontrol edin.',
          };
        }
      }

      await prisma.$transaction(async (tx) => {
        let finalAssignments = sealPayload?.sealAssignments || [];

        // Otomatik mühür atama (Eğer assignments gelmediyse veya eksikse)
        if (bags > 0 && finalAssignments.length < bags) {
          const available = await sealService.getNextAvailableSeals(existing.shopId, bags);
          if (available.length < bags) {
            throw new Error(`Dükkan mühür stoğu yetersiz (mevcut: ${available.length}, gereken: ${bags}).`);
          }
          
          const slots: ('S' | 'M' | 'XL')[] = [];
          for (let i = 0; i < existing.bagCountS; i++) slots.push('S');
          for (let i = 0; i < existing.bagCountM; i++) slots.push('M');
          for (let i = 0; i < existing.bagCountXl; i++) slots.push('XL');

          finalAssignments = available.map((s, idx) => ({
            sealNumber: s.serialNumber,
            bagIndex: idx + 1,
            bagSize: slots[idx],
          }));
        }

        if (bags > 0) {
          await sealService.applyCheckInWithinTx(tx, {
            shopId: existing.shopId,
            bookingId,
            assignments: finalAssignments,
            faultySealNumbers: sealPayload?.faultySealNumbers ?? [],
            sealPhotoUrl,
          });
        }
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CHECKED_IN',
            ...(sealPhotoUrl != null ? { sealPhotoUrl } : {}),
            updatedAt: new Date(),
          },
        });
      });
      return { ok: true };
    } catch (error) {
      console.error('BookingService::checkIn Error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'duplicate_seal_in_assignments') {
        return {
          ok: false,
          code: 'SEAL_INVALID',
          message: 'Aynı mühür numarası iki kez kullanılamaz.',
        };
      }
      if (msg === 'faulty_overlaps_assignment') {
        return {
          ok: false,
          code: 'FAULTY_OVERLAPS_ASSIGNMENT',
          message: 'Hatalı mühür ile atanan mühür aynı olamaz.',
        };
      }
      if (msg.startsWith('SEAL_FAULTY_INVALID')) {
        return {
          ok: false,
          code: 'SEAL_FAULTY_INVALID',
          message:
            'Hatalı işaretlenen mühür bulunamadı veya bu dükkana atanmamış.',
        };
      }
      if (msg.startsWith('SEAL_NOT_ASSIGNED')) {
        return {
          ok: false,
          code: 'SEAL_NOT_ASSIGNED',
          message: 'Mühür kullanılamıyor (atanmamış veya kullanımda).',
        };
      }
      if (msg.startsWith('SEAL_INVALID')) {
        return {
          ok: false,
          code: 'SEAL_INVALID',
          message: 'Mühür numarası geçersiz veya bu dükkana ait değil.',
        };
      }
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

      // 2. Mühürleri iade + statüyü CHECKED_OUT yap
      await prisma.$transaction(async (tx) => {
        await sealService.applyCheckOutReturnSealsWithinTx(tx, bookingId);
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CHECKED_OUT',
            checkOutTime: now,
            updatedAt: now,
          },
        });
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
   * Tek kullanımlı indirim kuponu = “platform kredisi” (check-in’e &lt;1 saat kala nakit iade yok).
   */
  private async issueCancellationCreditCoupon(amountTry: number): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `EM${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      try {
        await prisma.coupon.create({
          data: {
            code,
            discount: Math.round(amountTry * 100) / 100,
            isPercent: false,
            maxUses: 1,
            usedCount: 0,
            isActive: true,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
        return code;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new Error('credit_coupon_generation_failed');
  }

  /**
   * Rezervasyon İptali ve İade Süreci
   * Kademe: ≥24s check-in → tam kart iadesi; ≥1s → %50 kart iadesi; &lt;1s veya geçmiş check-in → kartsız, tek kullanımlı kupon (tutar kadar).
   * Ödeme alınmışsa iade başarısızsa rezervasyon CANCELLED yapılmaz.
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

    const hasCapturedPayment = await prisma.paymentLog.findFirst({
      where: { bookingId, status: 'SUCCESS' },
    });
    const treatAsPaidRefund =
      booking.status === 'PAID' || !!hasCapturedPayment;

    try {
      let creditCode: string | undefined;

      if (treatAsPaidRefund) {
        const checkIn = new Date(booking.checkInTime);
        const tier = getCancellationTier(checkIn);
        const totalPaid = moneyToNumber(booking.totalPrice);
        const { cardRefund, isCreditOnly } = estimatePaidRefundForTier(
          totalPaid,
          tier
        );

        const { paymentService } = await import('@/services/PaymentService');

        if (isCreditOnly) {
          if (totalPaid > 0) {
            try {
              creditCode = await this.issueCancellationCreditCoupon(totalPaid);
            } catch (e) {
              logger.error(
                { err: e, bookingId },
                'cancelBooking_credit_coupon_failed',
              );
              return {
                ok: false,
                code: 'UNKNOWN',
                message: 'Kupon oluşturulamadı; iptal tamamlanamadı.',
              };
            }
          }
        } else if (cardRefund > 0) {
          const partialRefund = cardRefund + 0.02 < totalPaid;
          const refundResult = await paymentService.refundPayment(
            bookingId,
            cardRefund,
            partialRefund ? { keepPaymentLogSuccess: true } : undefined
          );
          if (!isRefundSuccess(refundResult?.status)) {
            logger.error(
              { bookingId, cardRefund, status: refundResult?.status },
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

      return { ok: true, creditCode };
    } catch (error) {
      logger.error({ err: error, bookingId }, 'BookingService::cancelBooking');
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'İptal sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }

  /**
   * Misafir rezervasyonunu günceller (tarih / valiz sayıları).
   * Ödeme alınmışsa tutar düşüşünde kısmi iade; tutar artışı desteklenmez (iptal + yeniden rezervasyon).
   */
  async modifyBooking(
    bookingId: string,
    guestId: string,
    input: ModifyBookingInput
  ): Promise<ModifyBookingResult> {
    const rules = await getPricingRules();

    if (
      !validateBookingStayWindow(
        input.checkInTime,
        input.checkOutTime,
        rules
      )
    ) {
      return {
        ok: false,
        code: 'INVALID_DATES',
        message: 'Geçersiz tarih aralığı.',
      };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { shop: true },
    });

    if (!booking) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Rezervasyon bulunamadı.',
      };
    }
    if (booking.guestId !== guestId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Bu rezervasyonu düzenleyemezsiniz.',
      };
    }

    if (
      booking.status === 'CHECKED_IN' ||
      booking.status === 'CHECKED_OUT' ||
      booking.status === 'CANCELLED'
    ) {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: 'Bu rezervasyon düzenlenemez.',
      };
    }

    const hasCapturedPayment = await prisma.paymentLog.findFirst({
      where: { bookingId, status: 'SUCCESS' },
    });
    const isPaidLike =
      booking.status === 'PAID' || !!hasCapturedPayment;

    const unitPrice = moneyToNumber(booking.shop.pricePerDay);
    const authTotals = computeAuthoritativeCheckoutTotals(
      unitPrice,
      input.bagCountS,
      input.bagCountM,
      input.bagCountXl,
      input.checkInTime,
      input.checkOutTime,
      rules
    );
    const bagTotal =
      authTotals.bagCountS +
      authTotals.bagCountM +
      authTotals.bagCountXl;
    if (bagTotal < 1) {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: 'En az bir valiz seçilmelidir.',
      };
    }
    const newTotal = authTotals.subtotalBeforeCoupon;
    const oldTotal = moneyToNumber(booking.totalPrice);

    if (isPaidLike && newTotal > oldTotal + 0.005) {
      return {
        ok: false,
        code: 'PRICE_INCREASE',
        message:
          'Ödeme alınmış rezervasyonda tutar artırılamaz. İptal edip yeniden rezervasyon oluşturabilirsiniz.',
      };
    }

    const refundDue =
      isPaidLike && newTotal < oldTotal - 0.005
        ? Math.round((oldTotal - newTotal) * 100) / 100
        : 0;

    if (refundDue > 0) {
      const { paymentService } = await import('@/services/PaymentService');
      const refundResult = await paymentService.refundPayment(
        bookingId,
        refundDue,
        { keepPaymentLogSuccess: true }
      );
      if (!isRefundSuccess(refundResult.status)) {
        logger.error(
          { bookingId, refundDue, status: refundResult.status },
          'modifyBooking_refund_failed',
        );
        return {
          ok: false,
          code: 'REFUND_FAILED',
          message:
            'İade tamamlanamadı; rezervasyon değiştirilmedi. Lütfen tekrar deneyin.',
        };
      }
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT 1 FROM "Shop" WHERE id = $1::uuid FOR UPDATE`,
            booking.shopId
          );
          const shop = await tx.shop.findUnique({
            where: { id: booking.shopId },
          });
          if (!shop) {
            throw new Error('Shop missing');
          }

          const newBags = totalBagCount(
            input.bagCountS,
            input.bagCountM,
            input.bagCountXl
          );
          await this.assertCapacityTx(
            tx,
            shop,
            booking.shopId,
            input.checkInTime,
            input.checkOutTime,
            newBags,
            bookingId
          );

          await tx.booking.update({
            where: { id: bookingId },
            data: {
              checkInTime: input.checkInTime,
              checkOutTime: input.checkOutTime,
              bagCountS: authTotals.bagCountS,
              bagCountM: authTotals.bagCountM,
              bagCountXl: authTotals.bagCountXl,
              unitPrice: authTotals.unitPrice,
              insuranceFee: authTotals.insuranceFee,
              totalPrice: newTotal,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return { ok: true };
    } catch (error) {
      if (error instanceof BookingCapacityExceededError) {
        return {
          ok: false,
          code: 'CAPACITY',
          message: error.message,
        };
      }
      logger.error({ err: error, bookingId }, 'BookingService::modifyBooking');
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Düzenleme sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }
}

export const bookingService = new BookingService();
