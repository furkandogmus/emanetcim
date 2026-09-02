/**
 * Valiz revizyonu: gercekte teslim alinan valiz sayisi rezervasyondakinden farkliysa.
 *
 * NEDEN AYRI BIR MODUL (2026-08-25'te olculdu): bu islem IKI KEZ yazilmisti — web
 * `src/actions/partner.ts` (oner -> uygula iki adimli) ve mobil
 * `src/app/api/mobile/partner/bookings/[id]/bag-revision` (dogrudan uygula). Ikisi de
 * `prisma.booking.update` ile PARA alanlarina (`totalPrice`, `insuranceFee`) yaziyordu
 * ve UC yerde ayrisimisti:
 *
 *   1. **Durum kosulu birbirinin tersiydi.** Web `PAID | CHECKED_IN` istiyordu,
 *      mobil `APPROVED | PAID`. Yani ayni rezervasyon icin ayni islem web'de
 *      kabul edilip mobilde reddediliyordu (ve tersi).
 *   2. **Mobil `pendingBagRevision`'i TEMIZLEMIYORDU.** Web'den onerilmis bekleyen
 *      bir revizyon varken esnaf mobilden revizyon yaparsa, eski oneri kayitta
 *      kaliyor ve sonradan BIR KEZ DAHA uygulanabiliyordu — guncellenmis sayilarin
 *      uzerine eski delta biniyordu.
 *   3. Mobil `unitPrice` yaziyordu, web yazmiyordu.
 *
 * Tek govde. Durum kosulu ikisinin BIRLESIMI olarak birlestirildi
 * (`APPROVED | PAID | CHECKED_IN`): boylece hicbir tasiyici calisan bir yetenegini
 * kaybetmiyor ve "web'de olur, mobilde olmaz" tutarsizligi bitiyor. Daraltilmasi
 * gerekiyorsa bu bir IS KARARIDIR ve tek satirda yapilir.
 *
 * Para NOTU: bu islem fark tutarini TAHSIL ETMEZ (`settled: false`). Saglayici
 * `manual` oldugu surece tahsilat dukkanda yapilir; defterle baglanmasi ayri is
 * (P1-21). Bu yuzden `PaymentService` cagrilmaz — ama fark denetim izine yazilir.
 */
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import logger from '@/lib/logger';
import { moneyToNumber } from '@/lib/money';
import { getPricingRules } from '@/lib/platform-settings';
import { readPricingSnapshot } from '@/lib/pricing-snapshot';
import { computeAuthoritativeCheckoutTotals } from '@/lib/booking-server-price';
import { bookingEventService } from '@/services/BookingEventService';
import { updateReservedBags } from '@/services/SlotService';

export type BagRevisionActor = { id: string; role: 'PARTNER' | 'ADMIN' };

export type BagCounts = { bagCountS: number; bagCountM: number; bagCountXl: number };

export type BagRevisionErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS'
  | 'INVALID_COUNTS'
  | 'NO_PENDING_REVISION'
  /* Yeni valiz sayisi slot kapasitesine sigmiyor. */
  | 'CAPACITY_EXCEEDED'
  | 'UNKNOWN';

export type BagRevisionResult =
  | { ok: true; newTotal: number; delta: number }
  | { ok: false; code: BagRevisionErrorCode };

export type ProposeRevisionResult =
  | { ok: true; extraAmount: number }
  | { ok: false; code: BagRevisionErrorCode };

/**
 * Revizyona IZIN VERILEN durumlar — web ve mobilin birlesimi.
 * Ayrintili gerekce dosya basinda.
 */
const REVISABLE_STATUSES = ['APPROVED', 'PAID', 'CHECKED_IN'] as const;

function isRevisable(status: string): boolean {
  return (REVISABLE_STATUSES as readonly string[]).includes(status);
}

type RevisableBooking = NonNullable<Awaited<ReturnType<typeof findBooking>>>;

function findBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true },
  });
}

/**
 * Rezervasyonu okur ve ALAN yetkisini dogrular.
 * Yetki servistedir: iki tasiyici bunu kendi tarafinda yazdiginda sapmisti.
 */
async function loadForRevision(
  bookingId: string,
  actor: BagRevisionActor,
): Promise<{ booking: RevisableBooking } | { error: BagRevisionErrorCode }> {
  const booking = await findBooking(bookingId);
  if (!booking) return { error: 'NOT_FOUND' };
  if (actor.role === 'PARTNER' && booking.shop.ownerId !== actor.id) {
    return { error: 'FORBIDDEN' };
  }
  return { booking };
}

/**
 * Toplamlari rezervasyonun KENDI kural kumesiyle hesaplar.
 *
 * Anlik kopya (`pricingSnapshot`) varsa o kullanilir: admin bir carpani
 * degistirdikten sonra yapilan bir revizyon, rezervasyonun TAMAMINI bugunku
 * fiyata cevirmemeli (P0-4 ile ayni sinif).
 */
async function recompute(
  booking: { pricingSnapshot: Prisma.JsonValue; shop: { pricePerDay: Prisma.Decimal }; checkInTime: Date; checkOutTime: Date },
  counts: BagCounts,
) {
  const snapshot = readPricingSnapshot(booking.pricingSnapshot);
  const rules = snapshot ?? (await getPricingRules());
  const totals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(booking.shop.pricePerDay),
    counts.bagCountS,
    counts.bagCountM,
    counts.bagCountXl,
    new Date(booking.checkInTime),
    new Date(booking.checkOutTime),
    rules,
  );
  return {
    totals,
    rulesSource: snapshot ? 'booking_snapshot' : 'current_platform_settings',
    rules,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Revizyonu ONERIR: yalnizca `pendingBagRevision` kaydini yazar, rezervasyona DOKUNMAZ.
 *
 * `extraAmount` istemciden ALINMAZ — sunucuda hesaplanir. Eskiden istemciden
 * geliyordu, yani esnaf misafire gosterilecek ek ucreti kendisi yazabiliyordu (P1-8).
 */
export async function proposeBagRevision(
  bookingId: string,
  counts: BagCounts,
  actor: BagRevisionActor,
): Promise<ProposeRevisionResult> {
  try {
    const loaded = await loadForRevision(bookingId, actor);
    if ('error' in loaded) return { ok: false, code: loaded.error };
    const { booking } = loaded;

    if (!isRevisable(booking.status)) return { ok: false, code: 'INVALID_STATUS' };
    if (counts.bagCountS + counts.bagCountM + counts.bagCountXl < 1) {
      return { ok: false, code: 'INVALID_COUNTS' };
    }

    const { totals: after, rulesSource } = await recompute(booking, counts);
    const { totals: before } = await recompute(booking, {
      bagCountS: booking.bagCountS,
      bagCountM: booking.bagCountM,
      bagCountXl: booking.bagCountXl,
    });
    const extraAmount = round2(after.subtotalBeforeCoupon - before.subtotalBeforeCoupon);

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        pendingBagRevision: {
          ...counts,
          /** Sunucuda hesaplandi. Negatif olabilir (valiz azaldiysa). */
          extraAmount,
          previousTotal: before.subtotalBeforeCoupon,
          newTotal: after.subtotalBeforeCoupon,
          /** Hangi kural kumesiyle hesaplandi — anlik kopya mi, bugunku mu. */
          rulesSource,
          recordedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, extraAmount };
  } catch (err) {
    logger.error({ err, bookingId }, 'propose_bag_revision_failed');
    return { ok: false, code: 'UNKNOWN' };
  }
}

/**
 * Revizyonu UYGULAR: valiz sayilarini ve yeniden hesaplanan toplami yazar.
 *
 * `counts` verilmezse bekleyen oneri kullanilir (web'in iki adimli akisi);
 * verilirse dogrudan uygulanir (mobilin tek adimli akisi). HER IKI durumda da
 * `pendingBagRevision` TEMIZLENIR — mobil bunu yapmadigi icin eski oneri kayitta
 * kaliyor ve tekrar uygulanabiliyordu.
 *
 * Sayilar ve toplam TEK `update` ile degisir; aralarinda bir an bile tutarsiz kalmazlar.
 */
export async function applyBagRevision(
  bookingId: string,
  actor: BagRevisionActor,
  opts: { counts?: BagCounts; source?: 'web' | 'mobile' } = {},
): Promise<BagRevisionResult> {
  try {
    const loaded = await loadForRevision(bookingId, actor);
    if ('error' in loaded) return { ok: false, code: loaded.error };
    const { booking } = loaded;

    if (!isRevisable(booking.status)) return { ok: false, code: 'INVALID_STATUS' };

    let counts = opts.counts;
    if (!counts) {
      const pending = booking.pendingBagRevision as Partial<BagCounts> | null;
      if (
        !pending ||
        typeof pending.bagCountS !== 'number' ||
        typeof pending.bagCountM !== 'number' ||
        typeof pending.bagCountXl !== 'number'
      ) {
        return { ok: false, code: 'NO_PENDING_REVISION' };
      }
      counts = {
        bagCountS: pending.bagCountS,
        bagCountM: pending.bagCountM,
        bagCountXl: pending.bagCountXl,
      };
    }
    if (counts.bagCountS + counts.bagCountM + counts.bagCountXl < 1) {
      return { ok: false, code: 'INVALID_COUNTS' };
    }

    /*
      Toplam SUNUCUDA yeniden hesaplaniyor; `pendingBagRevision` icindeki tutara
      GUVENILMIYOR — o kayit onerildigi anda yazildi, aradan zaman gecmis olabilir.
    */
    const { totals, rulesSource } = await recompute(booking, counts);
    const previousTotal = moneyToNumber(booking.totalPrice);
    const delta = round2(totals.subtotalBeforeCoupon - previousTotal);

    /*
      SLOT DEFTERI DE GUNCELLENIR -- ve TEK ISLEMDE.

      Onceki hali yalnizca `Booking.bagCount*`i yaziyordu. Ama musaitlik hesabi
      slot tabanli rezervasyonlarda `ReservationSlot.bagCount` toplamini okuyor;
      `Booking.bagCount*` yalnizca slotu OLMAYAN eski kayitlar icin. Yani valiz
      sayisi artiyor, defter eski kaliyor ve dukkan AYNI kapasiteyi ikinci kez
      satabiliyordu:

        kapasite 10 · A 2 valizle rezerve eder  -> defter: 2
        esnaf 8 valize cikarir                  -> Booking: 8, defter: 2
        sistem 8 yer bos sanir, B 8 valiz alir  -> dukkanda 16 valiz

      Kapasite kontrolu de yoktu: esnaf sayiyi kapasitenin ustune cikarabiliyordu.
      Ikisi `updateReservedBags` icinde, cunku ayni soruyu soruyorlar.

      Tek transaction: defter guncellenip rezervasyon guncellenmeden surec
      olurse, misafirin odedigi tutar ile yer kaplamasi ayrisirdi.
    */
    const yeniToplam = totals.bagCountS + totals.bagCountM + totals.bagCountXl;
    const slotSonucu = await prisma.$transaction(async (tx) => {
      const defter = await updateReservedBags(tx, bookingId, yeniToplam);
      if (!defter.ok) return defter;

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          bagCountS: totals.bagCountS,
          bagCountM: totals.bagCountM,
          bagCountXl: totals.bagCountXl,
          unitPrice: totals.unitPrice,
          insuranceFee: totals.insuranceFee,
          totalPrice: totals.subtotalBeforeCoupon,
          /* Uygulandi; bekleyen oneri her iki akista da DUSER. */
          pendingBagRevision: Prisma.JsonNull,
        },
      });
      return { ok: true as const };
    });

    if (!slotSonucu.ok) {
      logger.warn(
        {
          bookingId,
          yeniToplam,
          slotStart: slotSonucu.slotStart,
          available: slotSonucu.available,
        },
        "bag_revision_capacity_exceeded",
      );
      return { ok: false, code: 'CAPACITY_EXCEEDED' };
    }

    await bookingEventService
      .record({
        bookingId,
        event: 'BAGS_MODIFIED',
        actorId: actor.id,
        actorRole: actor.role,
        metadata: {
          from: {
            S: booking.bagCountS,
            M: booking.bagCountM,
            XL: booking.bagCountXl,
            total: previousTotal,
          },
          to: {
            S: totals.bagCountS,
            M: totals.bagCountM,
            XL: totals.bagCountXl,
            total: totals.subtotalBeforeCoupon,
          },
          delta,
          rulesSource,
          source: opts.source ?? 'web',
          /**
           * Fark HENUZ TAHSIL EDILMEDI. Saglayici `manual` oldugu surece tahsilat
           * dukkanda yapilir; odeme defterine baglanmasi ayri is (P1-21). Bu alan
           * operasyonun takip etmesi gereken seydir.
           */
          settled: false,
        },
      })
      .catch((err) => logger.error({ err, bookingId }, 'bag_revision_apply_event_failed'));

    return { ok: true, newTotal: totals.subtotalBeforeCoupon, delta };
  } catch (err) {
    logger.error({ err, bookingId }, 'apply_bag_revision_failed');
    return { ok: false, code: 'UNKNOWN' };
  }
}

/**
 * Revizyonu REDDEDER: oneriyi siler, rezervasyona DOKUNMAZ.
 *
 * Uygulamaktan ayri olmasi bilincli: eskiden tek bir "temizle" vardi ve o,
 * uygulamak ile reddetmek arasinda ayrim yapmadan oneriyi yok ediyordu (P1-8).
 */
export async function clearBagRevision(
  bookingId: string,
  actor: BagRevisionActor,
): Promise<{ ok: true } | { ok: false; code: BagRevisionErrorCode }> {
  try {
    const loaded = await loadForRevision(bookingId, actor);
    if ('error' in loaded) return { ok: false, code: loaded.error };

    await prisma.booking.update({
      where: { id: bookingId },
      data: { pendingBagRevision: Prisma.JsonNull },
    });
    return { ok: true };
  } catch (err) {
    logger.error({ err, bookingId }, 'clear_bag_revision_failed');
    return { ok: false, code: 'UNKNOWN' };
  }
}
