/**
 * Check-in: durum, calisma saati, muhur kaydi (P1-23), odeme kaniti (P1-9).
 */
import prisma from '@/lib/db';

import logger from '@/lib/logger';
import { isShopOpenForHandover } from '@/lib/shop-hours';
import { totalBagCount } from '@/lib/bag-pricing';
import { sealService } from '@/services/SealService';
import { getPricingRules } from '@/lib/platform-settings';
import { moneyToNumber } from '@/lib/money';
import { PartnerCheckInResult } from '@/types/partner-booking';
import { bookingEventService } from '@/services/BookingEventService';
import { paymentService, type PaymentActor } from '@/services/PaymentService';
import type { CheckInSealPayload } from '@/services/BookingService';

export async function checkIn(
  bookingId: string,
  seals?: CheckInSealPayload,
  actor?: PaymentActor,
): Promise<PartnerCheckInResult> {
  try {
    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { shop: true, seals: true },
    });
    if (!existing) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Rezervasyon bulunamadı.',
      };
    }
    /*
      Kurallar burada okunuyor cunku hem saat toleransi hem muhur zorunlulugu
      bunlara bagli. Iki ayri okuma yapmak, ayni istekte iki kez ayni satiri
      cekmek olurdu.
    */
    const rules = await getPricingRules();

    if (existing.status !== 'PAID' && (existing.status as string) !== 'APPROVED') {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: `Check-in için onaylanmış veya ödenmiş olmalı (durum: ${existing.status}).`,
      };
    }
    if (
      /*
        `open247` ve dükkanın SAAT DİLİMİ buraya girmek zorunda: eskiden
        `isShopOpenAt` doğrudan çağrılıyordu ve ikisi de düşüyordu. Sonucu
        misafir ödüyordu -- 24/7 işaretli bir dükkan aramada 22:00 slotunu
        satıyor, misafir valiziyle geliyor, tezgâhta "dükkan kapalı" yiyordu.
      */
      !isShopOpenForHandover(
        existing.shop.openingTime,
        existing.shop.closingTime,
        existing.shop.open247,
        new Date(),
        existing.shop.timezone ?? undefined,
        rules.checkInGraceMin,
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

    /**
     * MÜHÜR KAYDI OLMADAN BAVUL KABUL EDİLMEZ — ayar açıksa (P1-23).
     *
     * 2026-08-22'de `BookingSeal` tablosu TAMAMEN BOŞTU, buna karşılık 3
     * `CHECKED_IN` rezervasyon vardı: üç bavul dükkanda ama hangi mühürle
     * mühürlendikleri hiçbir yerde kayıtlı değil. Mühür, anlaşmazlıkta
     * zilyetliğin kanıtıdır — "bu bavul mühürlü teslim alındı, numarası şu,
     * çıkışta aynı mühür sağlamdı". Kaydı yoksa platform hiçbir şey ispat edemez.
     *
     * `SEAL_REQUIRED` hata kodu tipte ZATEN VARDI ama hiç kullanılmıyordu —
     * zorlama planlanmış, hiç uygulanmamıştı.
     *
     * Ayar VARSAYILAN OLARAK KAPALI: lansmanda esnafın elinde mühür olmayabilir
     * ve açık olması check-in'i tamamen bloke eder.
     */
    if (rules.requireSealsOnCheckIn) {
      const bagCount = totalBagCount(
        existing.bagCountS,
        existing.bagCountM,
        existing.bagCountXl,
      );
      const providedSeals = seals?.sealAssignments?.length ?? 0;
      if (bagCount > 0 && providedSeals === 0) {
        return {
          ok: false,
          code: 'SEAL_REQUIRED',
          message: `Bu rezervasyonda ${bagCount} valiz var; her biri için mühür numarası girilmeli.`,
        };
      }
      if (providedSeals > 0 && providedSeals !== bagCount) {
        return {
          ok: false,
          code: 'SEAL_COUNT_MISMATCH',
          message: `${bagCount} valiz için ${providedSeals} mühür girildi; sayılar eşit olmalı.`,
        };
      }
    }

    /**
     * ÖDEME KANITI OLMADAN BAVUL KABUL EDİLMEZ (P1-9).
     *
     * 2026-08-22'de prod'da 7 rezervasyon ödeme kaydı olmadan ilerlemişti;
     * ikisinde bavul zaten dükkana teslim edilmişti. Kural yoktu.
     *
     * Doğru kural sağlayıcıya bağlıdır, sabit değil:
     *   - Sağlayıcı ONLINE tahsil ediyorsa (`capturesOnline`), para check-in'den
     *     ÖNCE alınmış olmalı. Alınmamışsa check-in reddedilir — misafir
     *     ödemeden bavul bırakamaz.
     *   - Sağlayıcı online tahsil ETMİYORSA (lansmandaki `manual`, yani dükkanda
     *     tahsilat), check-in **tam olarak paranın el değiştirdiği andır**.
     *     O yüzden burada tahsil ediliyor: niyet yoksa açılıyor, sonra
     *     yakalanıyor. Esnafın "aldım" beyanı deftere ve denetim izine yazılıyor.
     *
     * SIRA ÖNEMLİ — önce tahsilat, sonra check-in. Aradaki bir çökme `PAID` +
     * defter satırı bırakır ki bu GEÇERLİ bir durumdur (ödendi, henüz teslim
     * alınmadı). Ters sıra ise `CHECKED_IN` ama ödemesiz bırakırdı — düzeltmeye
     * çalıştığımız hatanın ta kendisi.
     */
    const alreadyCaptured = await paymentService.hasCapturedPayment(bookingId);
    if (!alreadyCaptured) {
      if (paymentService.capabilities.capturesOnline) {
        return {
          ok: false,
          code: 'PAYMENT_REQUIRED',
          message:
            'Bu rezervasyonun ödemesi alınmamış. Ödeme tamamlanmadan bavul teslim alınamaz.',
        };
      }

      const totalPrice = moneyToNumber(existing.totalPrice);
      const intent = await paymentService.openIntent({
        bookingId,
        amount: totalPrice,
        actor,
      });
      if (!intent.ok) {
        logger.error(
          { bookingId, code: intent.code, message: intent.message },
          'checkin_payment_intent_failed',
        );
        return {
          ok: false,
          code: 'PAYMENT_REQUIRED',
          message: 'Ödeme kaydı açılamadı; check-in tamamlanamıyor.',
        };
      }

      const captured = await paymentService.markCaptured({ bookingId, actor });
      if (!captured.ok) {
        logger.error(
          { bookingId, code: captured.code, message: captured.message },
          'checkin_payment_capture_failed',
        );
        return {
          ok: false,
          code: 'PAYMENT_REQUIRED',
          message: 'Tahsilat kaydedilemedi; check-in tamamlanamıyor.',
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      const updateResult = await tx.booking.updateMany({
        where: { 
          id: bookingId,
          bookingRowVersion: existing.bookingRowVersion,
        },
        data: {
          status: 'CHECKED_IN',
          // GERÇEKLEŞEN teslim alma anı. Rezerve pencere (`checkInTime`)
          // değişmez — planlanan ile gerçekleşenin karışması P1-10'du.
          checkedInAt: new Date(),
          bookingRowVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("Concurrency conflict: Rezervasyon başka bir işlem tarafından güncellendi.");
      }

      /**
       * Mühür yazımı `SealService`'e devredilir — burada satır içi YAZILMAZ.
       *
       * Buradaki eski satır içi döngü doğrulamanın TAMAMINI atlıyordu:
       * mührün bu dükkana ait olup olmadığına, `ASSIGNED` durumunda olup
       * olmadığına ve payload içinde tekrar edip etmediğine bakmıyordu. Yani
       * BAŞKA BİR DÜKKANIN mührü ya da HÂLİHAZIRDA `IN_USE` bir mühür ikinci
       * bir valize takılabiliyordu — mührün kanıt değerini bitiren şey tam da
       * budur. `faultySealNumbers` alanı ise hiç okunmuyordu; esnafın
       * "bu mühür bozuk çıktı" beyanı sessizce düşüyordu.
       *
       * `applyCheckInWithinTx` bu doğrulamaların hepsini yapar ve aşağıdaki
       * catch bloğunun ZATEN beklediği hata dizgelerini (`SEAL_INVALID:*`,
       * `SEAL_NOT_ASSIGNED:*`, `duplicate_seal_in_assignments`, ...) fırlatır.
       */
      if (seals?.sealAssignments?.length || seals?.faultySealNumbers?.length) {
        await sealService.applyCheckInWithinTx(tx, {
          shopId: existing.shopId,
          bookingId,
          assignments: seals.sealAssignments ?? [],
          faultySealNumbers: seals.faultySealNumbers ?? [],
          /*
            KANIT FOTOGRAFI (2026-09-01). Bu satir `null` SABITTI ve
            `BookingSeal.photoUrl` uretimde hicbir zaman dolmuyordu -- oysa urun
            uc yerde "teslimde muhur ve fotograf" vaat ediyordu. Tek engel bir
            depolama karariydi; karar S3 olarak verildi.

            Deger SUNUCUDAN geliyor: `checkInAction` baytlari dogrulayip
            depolamaya yaziyor ve donen adresi buraya koyuyor. Istemcinin
            gonderdigi bir adres asla buraya ulasmaz.
          */
          sealPhotoUrl: seals.sealPhotoUrl ?? null,
        });
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
