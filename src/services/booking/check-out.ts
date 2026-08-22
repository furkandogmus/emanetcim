/**
 * Check-out: gecikme ucreti, erken teslim iadesi, muhurlerin RETURNED'a cekilmesi.
 */
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

import logger from '@/lib/logger';
import { sealService } from '@/services/SealService';
import { getPricingRules } from '@/lib/platform-settings';
import { PartnerCheckOutResult } from '@/types/partner-booking';
import { bookingEventService } from '@/services/BookingEventService';

export async function checkOut(bookingId: string): Promise<PartnerCheckOutResult> {
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

    /**
     * Geç teslim alma ücreti — ARTIK KENDİ AYARINDAN.
     *
     * Eskiden `pricingRules.cancelFixedFeeTry` kullanılıyordu: iptal ücretini
     * değiştiren admin, gecikme ücretini de farkında olmadan değiştiriyordu.
     * Canlı `cancelFixedFeeTry = 0` olduğu için gecikme pratikte ÜCRETSİZDİ,
     * yani süreyi aşan müşterinin maliyetini partner üstleniyordu (P0-5).
     *
     * Tolerans da sabit 15 dakika değil, ayardan geliyor.
     */
    const scheduledEnd = new Date(booking.checkOutTime);
    const graceMs = pricingRules.latePickupGraceMin * 60 * 1000;
    const lateMs = now.getTime() - scheduledEnd.getTime();
    const lateFeeTry =
      lateMs > graceMs ? pricingRules.latePickupFeeTry : 0;
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
    const { pricingService } = await import('@/services/PricingService');
    const refundAmount = pricingService.calculateEarlyRefund(
      booking,
      now,
      pricingRules
    );

    // Harici ödeme sağlayıcısı yok; hesaplanan erken teslim tutarı manuel takip edilir.
    const failedRefundAmount = refundAmount;
    if (refundAmount > 0) {
      logger.info(
        { bookingId, refundAmount },
        'booking_early_checkout_refund_requires_manual_handling'
      );
    }

    // 2. Mühürleri iade + statüyü CHECKED_OUT yap (her durumda tamamlanır)
    await prisma.$transaction(async (tx) => {
      await sealService.applyCheckOutReturnSealsWithinTx(tx, bookingId);
      const updateResult = await tx.booking.updateMany({
        where: { id: bookingId, bookingRowVersion: booking.bookingRowVersion },
        data: {
          status: 'CHECKED_OUT',
          /**
           * `checkOutTime: now` KALDIRILDI (2026-08-22, P1-10).
           *
           * Rezerve bitiş zamanının üzerine yazmak, gecikme ücretinin ve erken
           * iadenin girdisini yok ediyordu: ikisi de `checkOutTime`'dan
           * hesaplanıyor, dolayısıyla çıkıştan sonra fatura yeniden kurulamıyordu.
           * Gerçekleşen an artık `checkedOutAt`.
           */
          checkedOutAt: now,
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
