/**
 * Iptal ve duzenleme: kesinti, kredi kuponu, kapasite yeniden kontrolu.
 */
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

import logger from '@/lib/logger';
import { totalBagCount } from '@/lib/bag-pricing';
import { getPricingRules } from '@/lib/platform-settings';
import { moneyToNumber } from '@/lib/money';
import { CancelBookingResult, ModifyBookingResult } from '@/types/partner-booking';
import { computeAuthoritativeCheckoutTotals, validateBookingStayWindow } from '@/lib/booking-server-price';
import { bookingEventService } from '@/services/BookingEventService';
import { paymentService } from '@/services/PaymentService';
import { BookingCapacityExceededError } from '@/services/booking/errors';
import { assertCapacityTx } from '@/services/booking/create';
import type { ModifyBookingInput } from '@/services/BookingService';

export async function issueCancellationCreditCoupon(amountTry: number): Promise<string> {
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
 * Rezervasyon iptali ve iade.
 *
 * KADEME YOK: check-in'e kalan süreye BAKILMAZ. Tahsilat varsa
 * `PaymentService.refund` ile TAM iade işaretlenir, yoksa açık ödeme niyeti
 * kapatılır; her iki durumda rezervasyon `CANCELLED` olur.
 *
 * Bu yorum 2026-08-24'e kadar "≥24s tam iade, ≥1s %50, sonrası kupon" diyordu
 * (P2-4). Ne kod ne de iptal ekranı öyle davranıyordu; yorum, iade mantığını
 * değiştirecek kişinin okuduğu İLK şey olduğu için en yanıltıcı yerdeydi.
 * Kademeli politika istenirse önce karar, sonra kod + metin birlikte değişir.
 *
 * Not: iade `PaymentLog`'da işaretlenir; para gerçekten geri gönderilmez —
 * entegre bir sağlayıcı yok (P0-2, docs/PAYMENTS.md).
 */
export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { reservationSlots: true },
  });

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
  const hadPayment =
    booking.status === 'PAID' || !!hasCapturedPayment;

  try {
    // İade defter üzerinden. Ham `updateMany` kaldırıldı: kısmi iadeyi
    // modelleyemiyordu, `refundedAmount` yazmıyordu ve denetim izi bırakmıyordu.
    if (hadPayment) {
      const refunded = await paymentService.refund({
        bookingId,
        reason: 'booking_cancelled',
      });
      if (!refunded.ok && refunded.code !== 'NOTHING_TO_REFUND') {
        logger.error(
          { bookingId, code: refunded.code, message: refunded.message },
          "payment_refund_mark_failed",
        );
      }
    } else {
      // Tahsilat olmadan iptal: açık kalmış niyeti kapat, defterde PENDING
      // satır sürünmesin.
      await paymentService
        .cancelIntent({ bookingId })
        .catch((err) => logger.error({ err, bookingId }, "payment_intent_cancel_failed"));
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      if (booking.reservationSlots.length > 0) {
        await tx.reservationSlot.deleteMany({ where: { bookingId } });
      }
    });

    // Sadakat puanlarını geri al
    if (booking.guestId) {
      const earnedPoints = Math.floor(moneyToNumber(booking.totalPrice));
      if (earnedPoints > 0) {
        prisma.$executeRaw`UPDATE "User" SET "loyaltyPoints" = GREATEST(0, "loyaltyPoints" - ${earnedPoints}) WHERE id = ${booking.guestId}`.catch((err) =>
          logger.error({ err, bookingId, guestId: booking.guestId, earnedPoints }, "loyalty_points_decrement_failed")
        );
      }
    }

    bookingEventService.record({
      bookingId,
      event: "CANCELLED",
      metadata: { previousStatus: booking.status, hadPayment, fullRefund: true },
    }).catch((err) => logger.error({ err, bookingId }, "booking_event_cancelled_failed"));

    return { ok: true, fullRefund: hadPayment };
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
export async function modifyBooking(
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

  if (isPaidLike && Math.abs(newTotal - oldTotal) > 0.005) {
    return {
      ok: false,
      code: 'PRICE_INCREASE',
      message:
        'Geçmiş ödeme kaydı bulunan rezervasyonun tutarı değiştirilemez.',
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "Shop" WHERE id = ${booking.shopId} FOR UPDATE`;
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
        await assertCapacityTx(
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
