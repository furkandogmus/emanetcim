/**
 * Esnafin rezervasyon talebini ONAYLAMASI ve REDDETMESI.
 *
 * NEDEN AYRI BIR MODUL (2026-08-25'te olculdu): bu iki islem IKI KEZ yazilmisti —
 * bir kez web action'inda (`src/actions/partner.ts`), bir kez mobil API ucunda
 * (`src/app/api/mobile/partner/bookings/[id]/{approve,reject}`). Ikisi de dogrudan
 * `prisma.booking.update` cagiriyordu, yani CLAUDE.md'nin "yazma islemleri yalnizca
 * `src/services/`" kurali fiilen delinmisti. Kopyalar zaten ayrisimisti:
 *
 *   1. **Mobil RED para iadesi yapmiyordu ve kapasiteyi serbest birakmiyordu.**
 *      Web `bookingService.cancelBooking()` cagiriyor; o da iadeyi/niyet iptalini
 *      `PaymentService` uzerinden isliyor, `ReservationSlot` satirlarini SILIYOR ve
 *      sadakat puanini geri aliyor. Mobil ise yalnizca `status = CANCELLED` yaziyordu:
 *      iptal edilen rezervasyonun slotlari dukkanin kapasitesini SONSUZA KADAR
 *      tutuyordu ve odeme defterinde acik satir kaliyordu.
 *   2. **Mobil ONAY bildirimi `"en"` sabitiyle gidiyordu.** Turk bir misafir, esnaf
 *      mobil uygulamadan onayladiginda Ingilizce e-posta aliyordu.
 *   3. Mobil red, `bookingRowVersion`'i artirmiyordu (iyimser kilit atlaniyordu) ve
 *      denetim izine farkli bir `reason` yaziyordu.
 *
 * Bunlarin hicbiri "unutulmus bir satir" degil: ayni kurali iki yere yazmanin
 * kaciniLMAZ sonucu. Tek govde, iki tasiyici — `partner.ts` ve mobil uc yalnizca
 * kimlik dogrulama, i18n ve HTTP/`revalidate` esleme yapar.
 *
 * `src/__tests__/service-layer-writes.test.ts` mandali bu sinirin yeniden
 * asinmasini engeller: `Booking` gibi alan-kritik modellere servis DISINDAN
 * yazilamaz.
 */
import { BookingStatus } from '@prisma/client';
import prisma from '@/lib/db';
import logger from '@/lib/logger';
import { bookingEventService } from '@/services/BookingEventService';
import { notificationService } from '@/services/NotificationService';
import { cancelBooking } from '@/services/booking/lifecycle';

export type PartnerReviewActor = {
  id: string;
  role: 'PARTNER' | 'ADMIN';
};

export type PartnerReviewErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS'
  | 'UNKNOWN';

export type PartnerReviewResult =
  | { ok: true }
  | { ok: false; code: PartnerReviewErrorCode };

/**
 * Bildirim dili. Web `getLocale()` ile isteginin dilini geciriyor; mobilin boyle
 * bir baglami yok ve eskiden `"en"` yaziyordu. Verilmezse projenin her yerdeki
 * varsayilanina (`"tr"`) duser — `NotificationService` imzasiyla ayni.
 *
 * Not: bu HALA misafirin degil, ISTEGIN dilidir. Dogru cozum misafirin dilini
 * rezervasyonda saklamak; `docs/DEFECT_BACKLOG.md` icinde acik madde olarak duruyor.
 */
type ReviewOptions = { locale?: string };

type ReviewableBooking = NonNullable<
  Awaited<ReturnType<typeof findReviewableBooking>>
>;

function findReviewableBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true, guest: { select: { email: true } } },
  });
}

/**
 * Rezervasyonu okur ve ALAN yetkisini dogrular.
 *
 * Yetki kontrolu bilerek SERVISTE: web ve mobil ayni kurali kendi tarafinda
 * yazdiginda sapan sey tam olarak buydu (mobil red, admin ayrimini hic yapmiyordu).
 * Oturum/token cozumu tasiyicida kalir, "bu esnaf bu dukkanin sahibi mi" burada.
 */
async function loadReviewableBooking(
  bookingId: string,
  actor: PartnerReviewActor,
): Promise<{ booking: ReviewableBooking } | { error: PartnerReviewErrorCode }> {
  const booking = await findReviewableBooking(bookingId);
  if (!booking) return { error: 'NOT_FOUND' };
  if (actor.role === 'PARTNER' && booking.shop.ownerId !== actor.id) {
    return { error: 'FORBIDDEN' };
  }
  return { booking };
}

/**
 * Talebi onaylar. `WAITING_APPROVAL` -> `APPROVED`.
 *
 * Durum gecisi `updateMany` ile ve `status` kosuluyla yapilir: iki esnaf ayni anda
 * onaylarsa ikincisi `INVALID_STATUS` alir, iki kez bildirim gitmez.
 */
export async function approveBooking(
  bookingId: string,
  actor: PartnerReviewActor,
  opts: ReviewOptions = {},
): Promise<PartnerReviewResult> {
  try {
    const loaded = await loadReviewableBooking(bookingId, actor);
    if ('error' in loaded) return { ok: false, code: loaded.error };
    const { booking } = loaded;

    const updated = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        shopId: booking.shopId,
        status: BookingStatus.WAITING_APPROVAL,
      },
      data: {
        status: BookingStatus.APPROVED,
        bookingRowVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) return { ok: false, code: 'INVALID_STATUS' };

    void bookingEventService
      .record({
        bookingId,
        event: 'APPROVED',
        actorId: actor.id,
        actorRole: actor.role,
      })
      .catch((err) => logger.error({ err, bookingId }, 'booking_event_approved_failed'));

    if (booking.guest?.email) {
      void notificationService
        .notifyBookingApproved(booking.guest.email, bookingId, booking.shop.name, opts.locale)
        .catch((err) => logger.error({ err, bookingId }, 'notify_booking_approved_failed'));
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err, bookingId }, 'approveBooking_failed');
    return { ok: false, code: 'UNKNOWN' };
  }
}

/**
 * Talebi reddeder / iptal eder.
 *
 * Esnaf yalnizca ONAY BEKLEYEN talebi reddedebilir; admin onaylanmis rezervasyonu da
 * iptal edebilir. Iptalin kendisi `cancelBooking`'e devredilir — iade, slot serbest
 * birakma ve sadakat puani geri alma orada, TEK yerde yasar.
 */
export async function rejectBooking(
  bookingId: string,
  actor: PartnerReviewActor,
  opts: ReviewOptions = {},
): Promise<PartnerReviewResult> {
  try {
    const loaded = await loadReviewableBooking(bookingId, actor);
    if ('error' in loaded) return { ok: false, code: loaded.error };
    const { booking } = loaded;

    // Onaylanmis bir rezervasyonu yalnizca admin iptal edebilir.
    if (booking.status === BookingStatus.APPROVED && actor.role !== 'ADMIN') {
      return { ok: false, code: 'FORBIDDEN' };
    }
    if (
      booking.status !== BookingStatus.WAITING_APPROVAL &&
      booking.status !== BookingStatus.APPROVED
    ) {
      return { ok: false, code: 'INVALID_STATUS' };
    }

    /*
      Ham `booking.update({ status: CANCELLED })` DEGIL. `cancelBooking`:
      iadeyi/acik odeme niyetini `PaymentService` uzerinden kapatir,
      `ReservationSlot` satirlarini siler (kapasite geri gelir) ve sadakat
      puanini dusurur. Mobil uc bunlarin hicbirini yapmiyordu.
    */
    const cancelled = await cancelBooking(bookingId);
    if (!cancelled.ok) return { ok: false, code: 'INVALID_STATUS' };

    void bookingEventService
      .record({
        bookingId,
        event: 'CANCELLED',
        actorId: actor.id,
        actorRole: actor.role,
        metadata: {
          reason: actor.role === 'ADMIN' ? 'cancelled_by_admin' : 'rejected_by_partner',
        },
      })
      .catch((err) => logger.error({ err, bookingId }, 'booking_event_cancelled_failed'));

    if (booking.guest?.email) {
      void notificationService
        .notifyBookingCancelled(booking.guest.email, bookingId, booking.shop.name, opts.locale)
        .catch((err) => logger.error({ err, bookingId }, 'notify_booking_cancelled_failed'));
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err, bookingId }, 'rejectBooking_failed');
    return { ok: false, code: 'UNKNOWN' };
  }
}

/** Bir kullanicinin silinmesi/yasaklanmasi sirasinda iptal edilen rezervasyon sayilari. */
export type ForceCancelSummary = { cancelled: number; failed: number };

/**
 * Bir kullanicinin (misafir veya dukkan sahibi) ACIK rezervasyonlarini toplu iptal eder.
 *
 * NEDEN SERVISTE (2026-08-25): `deleteUserAction` bunu ham
 * `prisma.booking.updateMany({ status: CANCELLED })` ile yapiyordu. Mobil "reddet"
 * ucundaki hatanin AYNISI: iade/odeme niyeti kapatilmiyor, `ReservationSlot`
 * satirlari SILINMIYOR ve sadakat puani geri alinmiyordu. Yani yasaklanan bir
 * esnafin dukkani silinse bile o dukkanin slotlari dolu gorunmeye devam ediyordu.
 *
 * Tek tek `cancelBooking`'den gecer: toplu `updateMany`den yavas ama iade ve
 * kapasite muhasebesi ancak boyle dogru olur. Biri basarisiz olursa digerleri
 * DEVAM EDER ve sayilar dondurulur — bir rezervasyonun takilmasi kullanici
 * silmeyi tumden bloke etmemeli.
 */
export async function forceCancelOpenBookingsForUser(
  userId: string,
  openStatuses: BookingStatus[],
): Promise<ForceCancelSummary> {
  const open = await prisma.booking.findMany({
    where: {
      status: { in: openStatuses },
      OR: [{ guestId: userId }, { shop: { ownerId: userId } }],
    },
    select: { id: true },
  });

  let cancelled = 0;
  let failed = 0;
  for (const { id } of open) {
    const result = await cancelBooking(id);
    if (result.ok) cancelled++;
    else {
      failed++;
      logger.error({ bookingId: id, userId, code: result.code }, 'force_cancel_booking_failed');
    }
  }
  return { cancelled, failed };
}
