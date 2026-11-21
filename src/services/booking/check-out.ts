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
import type { PaymentActor } from '@/services/PaymentService';

type CheckOutChargeSource = Parameters<
  (typeof import('@/services/PricingService'))['pricingService']['calculateEarlyRefund']
>[0];

/**
 * Teslim aninda olusacak gecikme ucreti ve erken teslim iadesi. Check-out bunu
 * kullanir; rezervasyon detayi da AYNI hesabi esnafa ONCEDEN gosterir. Eskiden
 * yalnizca deftere yaziliyordu: tezgahta kimse ucreti almasi ya da iadeyi
 * vermesi gerektigini bilmiyordu.
 */
export async function previewCheckOutCharges(
  booking: CheckOutChargeSource,
  now: Date,
  rules?: Awaited<ReturnType<typeof getPricingRules>>,
): Promise<{ lateFeeTry: number; earlyRefund: number }> {
  const pricingRules = rules ?? (await getPricingRules());
  const lateMs = now.getTime() - new Date(booking.checkOutTime).getTime();
  const lateFeeTry = lateMs > pricingRules.latePickupGraceMin * 60 * 1000 ? pricingRules.latePickupFeeTry : 0;
  const { pricingService } = await import('@/services/PricingService');
  const earlyRefund = pricingService.calculateEarlyRefund(booking, now, pricingRules);
  return { lateFeeTry, earlyRefund: earlyRefund > 0 ? earlyRefund : 0 };
}

export async function checkOut(
  bookingId: string,
  opts: { brokenSealNumbers?: number[]; actor?: PaymentActor } = {},
): Promise<PartnerCheckOutResult> {
  const brokenSealNumbers = opts.brokenSealNumbers ?? [];
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
    const { lateFeeTry, earlyRefund: refundAmount } = await previewCheckOutCharges(booking, now, pricingRules);
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
      await sealService.applyCheckOutReturnSealsWithinTx(tx, bookingId, brokenSealNumbers);
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

    /*
      Atesle-unut: teslim etme yazildi, olay kaydi onu bekletmez. `.catch` sart —
      yakalanmamis red sureci dusurur (`unhandled-rejection` mandali, tavan 0).
    */
    void bookingEventService.record({
      bookingId,
      event: "CHECKED_OUT",
      actorId: opts.actor?.id ?? null,
      actorRole: opts.actor?.role ?? null,
      impersonatedBy: opts.actor?.impersonatedBy ?? null,
      metadata: {
        lateFeeApplied: lateFeeTry,
        refundAmount: refundAmount > 0 ? refundAmount : undefined,
        failedRefundAmount: failedRefundAmount > 0 ? failedRefundAmount : undefined,
        // Teslimde saglam cikmayan muhurler: anlasmazlikta ilk bakilacak kayit.
        brokenSeals: brokenSealNumbers.length > 0 ? brokenSealNumbers : undefined,
      },
    }).catch((err) => logger.error({ err, bookingId }, "booking_event_checked_out_failed"));

    return {
      ok: true,
      ...(lateFeeTry > 0 ? { lateFee: lateFeeTry } : {}),
      ...(failedRefundAmount > 0
        ? { refundPending: true, refundAmount: failedRefundAmount }
        : {}),
    };
  } catch (error) {
    logger.error({ error }, 'BookingService::checkOut Error');
    if (error instanceof Error && error.message === 'broken_seal_not_on_booking') {
      return { ok: false, code: 'INVALID_SEALS', message: 'İşaretlenen mühür bu rezervasyona ait değil.' };
    }
    return {
      ok: false,
      code: 'UNKNOWN',
      message: 'Teslim sırasında beklenmeyen bir hata oluştu.',
    };
  }
}
