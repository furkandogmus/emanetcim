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
  referralDiscountAmount?: number;
  referredByCode?: string;
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


 export type GuestBookingListItem = Prisma.BookingGetPayload<{
  select: {
    id: true; guestId: true; shopId: true; checkInTime: true; checkOutTime: true;
    totalPrice: true; bagCountS: true; bagCountM: true; bagCountXl: true;
    status: true; qrCodeToken: true; createdAt: true;
    shop: { select: { name: true; address: true; pricePerDay: true } };
    dispute: { select: { id: true } };
  };
}>;

export type PartnerBookingListItem = Prisma.BookingGetPayload<{
  select: {
    id: true; checkInTime: true; checkOutTime: true;
    totalPrice: true; bagCountS: true; bagCountM: true; bagCountXl: true;
    status: true; createdAt: true;
    guest: { select: { name: true } };
  };
}>;
import { createQrToken } from '@/lib/qr-token';
import { isRefundSuccess } from '@/lib/payment-status';
import logger from '@/lib/logger';
import { isShopOpenAt } from '@/lib/shop-hours';
import { totalBagCount } from '@/lib/bag-pricing';
import { sealService, type SealAssignmentInput } from '@/services/SealService';
import { getPricingRules } from '@/lib/platform-settings';
import { moneyToNumber } from '@/lib/money';
import {
  PartnerCheckInResult,
  PartnerCheckOutResult,
  CancelBookingResult,
  ModifyBookingResult,
  BookingWithShopGuestDetails,
} from '@/types/partner-booking';
import {
  computeAuthoritativeCheckoutTotals,
  validateBookingStayWindow,
} from '@/lib/booking-server-price';
import { bookingEventService } from '@/services/BookingEventService';
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
    bookingId: string
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
    const booking = await prisma.$transaction(
      async (tx) => {
        const shop = await tx.shop.findUnique({ where: { id: data.shopId } });
        if (!shop) {
          throw new Error('Dükkan bulunamadı.');
        }
        await tx.$executeRawUnsafe(
          `SELECT 1 FROM "Shop" WHERE id = $1 FOR UPDATE`,
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

        const referralDiscountAmount =
          typeof data.referralDiscountAmount === 'number' && Number.isFinite(data.referralDiscountAmount)
            ? Math.max(0, data.referralDiscountAmount)
            : 0;

        const booking = await tx.booking.create({
          data: {
            guestId: data.guestId,
            shopId: data.shopId,
            totalPrice: data.totalPrice,
            insuranceFee,
            referralDiscountAmount,
            referredByCode: data.referredByCode ?? null,
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

    bookingEventService.record({
      bookingId: booking.id,
      event: "CREATED",
      actorId: data.guestId,
      actorRole: "GUEST",
      metadata: {
        shopId: data.shopId,
        totalPrice: data.totalPrice,
        bagCountS: data.bagCountS,
        bagCountM: data.bagCountM,
        bagCountXl: data.bagCountXl,
      },
    }).catch((err) => logger.error({ err, bookingId: booking.id }, "booking_event_created_failed"));

    return booking;
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
        OR: [
          // PAID ve CHECKED_IN her zaman sayılır
          { status: { in: ['PAID', 'CHECKED_IN'] } },
          // WAITING, APPROVED, PENDING ise sadece "taze" ise (check-in saati geçmemiş veya son 24 saat içinde)
          {
            AND: [
              { status: { in: ['WAITING_APPROVAL', 'APPROVED', 'PENDING'] } },
              { checkInTime: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            ]
          }
        ],
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
    bookingId: string
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
        logger.warn('BookingService::checkIn: dükkan kapalı saat aralığında');
        return {
          ok: false,
          code: 'SHOP_CLOSED',
          message:
            'Şu an dükkan kapalı görünüyor. Çalışma saatleri içinde tekrar deneyin.',
        };
      }

      await prisma.$transaction(async (tx) => {
        const updateResult = await tx.booking.updateMany({
          where: { 
            id: bookingId,
            bookingRowVersion: existing.bookingRowVersion,
          },
          data: {
            status: 'CHECKED_IN',
            bookingRowVersion: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        if (updateResult.count === 0) {
          throw new Error("Concurrency conflict: Rezervasyon başka bir işlem tarafından güncellendi.");
        }
      });

      bookingEventService.record({
        bookingId,
        event: "CHECKED_IN",
        metadata: { previousStatus: existing.status },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_checked_in_failed"));

      return { ok: true };
    } catch (error) {
      logger.error({ error }, 'BookingService::checkIn Error');
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

      const pricingRules = await getPricingRules();

      // Geç teslim alma: planlanan check-out + 15 dk sonrası → platform iptal sabit ücreti tutarında kayıt (tahsilat ayrı süreç)
      const scheduledEnd = new Date(booking.checkOutTime);
      const graceMs = 15 * 60 * 1000;
      const lateMs = now.getTime() - scheduledEnd.getTime();
      const lateFeeTry =
        lateMs > graceMs ? pricingRules.cancelFixedFeeTry : 0;
      if (lateFeeTry > 0) {
        logger.info(
          {
            bookingId,
            lateFeeTry,
            scheduledEnd: scheduledEnd.toISOString(),
            checkoutAt: now.toISOString(),
          },
          "booking_checkout_late_pickup_fee",
        );
      }

      // 1. Erken Teslimat İadesi Hesabı (UC_E_06_EXTRA)
      const { pricingService } = await import('./PricingService');
      const refundAmount = pricingService.calculateEarlyRefund(
        booking,
        now,
        pricingRules
      );

      // BUG-06 FIX: İade başarısız olsa da checkout tamamlanmalı.
      // Misafir valizi teslim aldı; sistemi CHECKED_IN'de bırakmak operasyonel kilitlenmeye yol açar.
      // Başarısız iade tutarı failedRefundAmount alanına kaydedilip reconcile edilir.
      let failedRefundAmount = 0;
      if (refundAmount > 0) {
        const { paymentService } = await import('@/services/PaymentService');
        try {
          const refundResult = await paymentService.refundPayment(
            bookingId,
            refundAmount
          );
          if (!isRefundSuccess(refundResult.status)) {
            logger.warn(
              { bookingId, refundAmount, refundResult },
              'booking_early_checkout_refund_failed_proceeding'
            );
            failedRefundAmount = refundAmount;
          }
        } catch (refundError) {
          logger.error(
            { bookingId, refundAmount, err: refundError },
            'booking_early_checkout_refund_exception_proceeding'
          );
          failedRefundAmount = refundAmount;
        }
      }

      // 2. Mühürleri iade + statüyü CHECKED_OUT yap (her durumda tamamlanır)
      await prisma.$transaction(async (tx) => {
        await sealService.applyCheckOutReturnSealsWithinTx(tx, bookingId);
        const updateResult = await tx.booking.updateMany({
          where: { id: bookingId, bookingRowVersion: booking.bookingRowVersion },
          data: {
            status: 'CHECKED_OUT',
            checkOutTime: now,
            lateFeeApplied: new Prisma.Decimal(lateFeeTry),
            pendingBagRevision: Prisma.JsonNull,
            bookingRowVersion: { increment: 1 },
            updatedAt: now,
            // İade başarısız olduysa reconcile için kayıt
            ...(failedRefundAmount > 0
              ? { failedRefundAmount: new Prisma.Decimal(failedRefundAmount) }
              : {}),
          },
        });
        if (updateResult.count === 0) {
          throw new Error("Concurrency conflict: Rezervasyon başka bir işlem tarafından güncellendi.");
        }
      });

      bookingEventService.record({
        bookingId,
        event: "CHECKED_OUT",
        metadata: {
          lateFeeApplied: lateFeeTry,
          refundAmount: refundAmount > 0 ? refundAmount : undefined,
          failedRefundAmount: failedRefundAmount > 0 ? failedRefundAmount : undefined,
        },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_checked_out_failed"));

      return {
        ok: true,
        ...(failedRefundAmount > 0
          ? { refundPending: true, refundAmount: failedRefundAmount }
          : {}),
      };
    } catch (error) {
      logger.error({ error }, 'BookingService::checkOut Error');
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

    bookingEventService.record({
      bookingId,
      event: "PAID",
    }).catch((err) => logger.error({ err, bookingId }, "booking_event_paid_failed"));
  }

  async getBookingDetails(id: string): Promise<BookingWithShopGuestDetails | null> {
    return await prisma.booking.findUnique({
      where: { id },
      include: {
        shop: { include: { owner: true } },
        guest: true,
        seals: { orderBy: { bagIndex: "asc" } },
      },
    });
  }

  async getUserBookings(userId: string): Promise<GuestBookingListItem[]> {
    return await prisma.booking.findMany({
      where: { guestId: userId },
      select: {
        id: true, guestId: true, shopId: true, checkInTime: true, checkOutTime: true,
        totalPrice: true, bagCountS: true, bagCountM: true, bagCountXl: true,
        status: true, qrCodeToken: true, createdAt: true,
        shop: { select: { name: true, address: true, pricePerDay: true } },
        dispute: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getPartnerBookings(shopId: string): Promise<PartnerBookingListItem[]> {
    return await prisma.booking.findMany({
      where: { shopId },
      select: {
        id: true, checkInTime: true, checkOutTime: true,
        totalPrice: true, bagCountS: true, bagCountM: true, bagCountXl: true,
        status: true, createdAt: true,
        guest: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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

      bookingEventService.record({
        bookingId,
        event: "CANCELLED",
        metadata: { previousStatus: booking.status, hadPayment: treatAsPaidRefund, creditCode },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_cancelled_failed"));

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
            `SELECT 1 FROM "Shop" WHERE id = $1 FOR UPDATE`,
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

      bookingEventService.record({
        bookingId,
        event: "MODIFIED",
        actorId: guestId,
        actorRole: "GUEST",
        metadata: {
          previousTotal: moneyToNumber(booking.totalPrice),
          newTotal,
          refundDue,
          checkInTime: input.checkInTime,
          checkOutTime: input.checkOutTime,
          bagCountS: input.bagCountS,
          bagCountM: input.bagCountM,
          bagCountXl: input.bagCountXl,
        },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_modified_failed"));

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
