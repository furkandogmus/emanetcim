/**
 * Rezervasyon olusturma: tarih penceresi / slot tabanli yol ve kapasite kilidi.
 *
 * `BookingService`'ten ayrildi (2026-08-22): 1186 satirlik sinif bes ayri
 * yasam dongusu adimini tasiyordu. Sinif cephe olarak kaldi; davranis ayni.
 */
import { BookingInputInvalidError } from '@/services/booking/errors';
import { retryOnWriteConflict } from '@/lib/tx-retry';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import prisma from '@/lib/db';

import { createQrToken } from '@/lib/qr-token';
import logger from '@/lib/logger';
import { totalBagCount } from '@/lib/bag-pricing';
import { getPricingRules } from '@/lib/platform-settings';
import { toPricingSnapshot } from '@/lib/pricing-snapshot';
import { moneyToNumber } from '@/lib/money';
import { reserveSlots } from '@/services/SlotService';
import { validateBookingStayWindow } from '@/lib/booking-server-price';
import { bookingTouchesPlatformHoliday } from '@/lib/booking-holidays';
import { bookingEventService } from '@/services/BookingEventService';
import {
  BookingCapacityExceededError,
  BookingWindowInvalidError,
  BookingHolidayError,
  BookingShopPrelaunchError,
} from '@/services/booking/errors';
import type { CreateInitialBookingInput, TxClient } from '@/services/BookingService';

/**
 * Rezervasyonun YARATILDIGI durum.
 *
 * NEDEN PARAMETRE (2026-08-25): her iki cagiran da — web `createBookingAction` ve
 * mobil `checkout/intent` — once `PENDING` yaratip HEMEN ardindan ham
 * `prisma.booking.update({ status: APPROVED })` yaziyordu. Iki sorunu vardi:
 *
 *   1. Iki adim arasinda surec olurse rezervasyon KALICI OLARAK `PENDING`
 *      kaliyordu; hicbir yol onu kurtarmiyordu.
 *   2. Ayni kural iki tasiyicida yaziliydi ve zaten ayrisimisti: web denetim
 *      izine `APPROVED` olayini yaziyordu, mobil YAZMIYORDU. Mobilden yapilan
 *      rezervasyonlarin onay izi hicbir yerde yoktu.
 *
 * Varsayilan `PENDING`: bu fonksiyonun eski sozlesmesi. Misafir akislari
 * `APPROVED` gecer (esnaf onayi beklenmez).
 */
const DEFAULT_INITIAL_STATUS: BookingStatus = 'PENDING';

/**
 * Servis seviyesinde girdi kapisi -- tasiyicilardan BAGIMSIZ.
 *
 * Gerekce `BookingInputInvalidError`de: negatif valiz slot dolulugunu
 * DUSURUP kapasiteyi sisiriyor, negatif tutar hakedise negatif taban veriyordu.
 */
function assertBookingInput(data: CreateInitialBookingInput): void {
  const sayilar = [data.bagCountS, data.bagCountM, data.bagCountXl];
  if (sayilar.some((n) => !Number.isFinite(n) || !Number.isInteger(n) || n < 0)) {
    throw new BookingInputInvalidError('Valiz sayısı geçersiz.');
  }
  if (sayilar.reduce((a, b) => a + b, 0) < 1) {
    // Sifir valiz yer kaplamaz ama kayit uretir; rezervasyonun konusu yok.
    throw new BookingInputInvalidError('En az bir valiz gerekli.');
  }
  if (!Number.isFinite(data.totalPrice) || data.totalPrice < 0) {
    throw new BookingInputInvalidError('Tutar geçersiz.');
  }
}

export async function createInitialBooking(data: CreateInitialBookingInput): Promise<Booking> {
  assertBookingInput(data);
  const rules = await getPricingRules();
  const initialStatus = data.initialStatus ?? DEFAULT_INITIAL_STATUS;

  /*
    Tarih dogrulamalari BURADA, tek yerde.

    2026-08-25'e kadar pencere kontrolu buradaydi ama TATIL kontrolu yalnizca web
    action'indaydi; mobil checkout ucu onu hic yapmiyordu, yani ayni tarih web'de
    reddedilirken mobilde kabul ediliyordu. Ayrica buradaki firlatma tipsiz bir
    Turkce cumleydi ve mobil uc onu yakalamadigi icin gecersiz tarih HTTP 500
    donuyordu.
  */
  if (!validateBookingStayWindow(data.checkInTime, data.checkOutTime, rules)) {
    throw new BookingWindowInvalidError();
  }
  if (
    bookingTouchesPlatformHoliday(
      data.checkInTime,
      data.checkOutTime,
      rules.platformHolidayDates,
    )
  ) {
    throw new BookingHolidayError();
  }

  /*
    Talep testi noktasina rezervasyon YAZILMAZ.

    Kapi BURADA cunku iki yol da (slot ve legacy) buradan geciyor ve ikisi de
    dukkani ancak KENDI transaction'i icinde okuyor -- kapiyi asagiya koymak onu
    iki kez yazmak demekti. Arayuz bu noktalarda zaten rezervasyon dugmesi
    gostermiyor; burasi son savunma: mobil uc, dogrudan API cagrisi ya da eski
    bir istemci ayni yolu denerse de olmayan bir adrese onay uretilmez.
  */
  const shopGate = await prisma.shop.findUnique({
    where: { id: data.shopId },
    select: { isPrelaunch: true },
  });
  if (shopGate?.isPrelaunch) {
    throw new BookingShopPrelaunchError();
  }

  const newBags = totalBagCount(data.bagCountS, data.bagCountM, data.bagCountXl);
  
  // Slot-based booking path
  if (data.slotIds && data.slotIds.length > 0) {
    return createSlotBooking(data, newBags, rules);
  }

  // Legacy datetime-pair path (backward compat)
  /*
    CAKISMADA YENIDEN DENENIR. `Serializable` bu hatayi URETMEK uzere
    tasarlanmistir ve cagirandan yeniden denemesini bekler -- Postgres'in kendi
    mesaji da "please retry" diyor. Olcum ve gerekce `@/lib/tx-retry`de.
  */
  const booking = await retryOnWriteConflict(() => prisma.$transaction(
    async (tx) => {
      const shop = await tx.shop.findUnique({ where: { id: data.shopId } });
      if (!shop) {
        throw new Error('Dükkan bulunamadı.');
      }
      await tx.$executeRaw`SELECT 1 FROM "Shop" WHERE id = ${data.shopId} FOR UPDATE`;

      const unitPrice =
        typeof data.unitPrice === 'number' && Number.isFinite(data.unitPrice)
          ? data.unitPrice
          : moneyToNumber(shop.pricePerDay) || rules.defaultPricePerDay;
      const insuranceFee =
        typeof data.insuranceFee === 'number' && Number.isFinite(data.insuranceFee)
          ? Math.max(0, data.insuranceFee)
          : 0;

      await assertCapacityTx(
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
          guestId: data.guestId ?? null,
          guestEmail: data.guestEmail ?? null,
          guestPhone: data.guestPhone ?? null,
          // Misafirin dili: bildirimler bunu okur. Bkz. `Booking.locale`.
          locale: data.locale ?? null,
          shopId: data.shopId,
          totalPrice: data.totalPrice,
          insuranceFee,
          referralDiscountAmount,
          referredByCode: data.referredByCode ?? null,
          /*
            Kupon indirimi de referans indirimi gibi DEFTERE yaziliyor. Ikisi
            ayni olay: fiyat dusuruldu ve sebebi kayitli olmali.
          */
          couponDiscountAmount:
            typeof data.couponDiscountAmount === 'number' && Number.isFinite(data.couponDiscountAmount)
              ? Math.max(0, data.couponDiscountAmount)
              : 0,
          couponCode: data.couponCode ?? null,
          bagCountS: data.bagCountS,
          bagCountM: data.bagCountM,
          bagCountXl: data.bagCountXl,
          checkInTime: data.checkInTime,
          checkOutTime: data.checkOutTime,
          unitPrice,
          pricingSnapshot: toPricingSnapshot(rules),
          qrCodeToken: `temp_${crypto.randomUUID()}`,
          status: initialStatus,
        },
      });

      const qrCodeToken = await createQrToken({
        bookingId: booking.id,
        guestId: data.guestId ?? booking.id,
        shopId: data.shopId,
      });

      return tx.booking.update({
        where: { id: booking.id },
        data: { qrCodeToken },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  ), { label: "createInitialBooking" });

  bookingEventService.record({
    bookingId: booking.id,
    event: "CREATED",
    actorId: data.guestId ?? "guest",
    actorRole: "GUEST",
    metadata: {
      shopId: data.shopId,
      totalPrice: data.totalPrice,
      bagCountS: data.bagCountS,
      bagCountM: data.bagCountM,
      bagCountXl: data.bagCountXl,
    },
  }).catch((err) => logger.error({ err, bookingId: booking.id }, "booking_event_created_failed"));

  if (initialStatus === 'APPROVED') {
    /*
      Esnaf onayi beklenmeyen akis. Olay burada yazilir ki mobil ve web ayni izi
      biraksin — 2026-08-25 oncesinde yalnizca web yaziyordu.
    */
    bookingEventService.record({
      bookingId: booking.id,
      event: 'APPROVED',
      actorId: data.guestId ?? 'guest',
      actorRole: 'GUEST',
      metadata: { autoApproved: true },
    }).catch((err) => logger.error({ err, bookingId: booking.id }, 'booking_event_approved_failed'));
  }

  return booking;
}

/**
 * Slot-based booking: reserves specific time slots with per-slot capacity.
 */
export async function createSlotBooking(
  data: CreateInitialBookingInput,
  newBags: number,
  rules: Awaited<ReturnType<typeof getPricingRules>>,
): Promise<Booking> {
  assertBookingInput(data);
  const initialStatus = data.initialStatus ?? DEFAULT_INITIAL_STATUS;
  // Cakismada yeniden denenir; gerekce `@/lib/tx-retry`de.
  const booking = await retryOnWriteConflict(() => prisma.$transaction(
    async (tx) => {
      const shop = await tx.shop.findUnique({ where: { id: data.shopId } });
      if (!shop) throw new Error('Dükkan bulunamadı.');

      const unitPrice =
        typeof data.unitPrice === 'number' && Number.isFinite(data.unitPrice)
          ? data.unitPrice
          : moneyToNumber(shop.pricePerHour ?? shop.pricePerDay) || rules.defaultPricePerDay;
      const insuranceFee =
        typeof data.insuranceFee === 'number' && Number.isFinite(data.insuranceFee)
          ? Math.max(0, data.insuranceFee)
          : 0;

      // Reserve slots via SlotService
      const { checkInTime, checkOutTime } = await reserveSlots(
        tx as Prisma.TransactionClient,
        data.shopId,
        data.checkInTime,
        data.checkOutTime,
        newBags,
      );

      /**
       * DÜKKAN KAPASİTESİ EMNİYET KONTROLÜ — slot kontrolüne EK olarak.
       *
       * NEDEN GEREKLİ (P1-2): iki rezervasyon yolu iki AYRI kapasite doğruluğu
       * kullanıyordu ve birbirlerini görmüyorlardı.
       *   - Legacy yol örtüşen `Booking` satırlarını sayar; `ReservationSlot`
       *     YAZMAZ.
       *   - Slot yolu yalnızca `ReservationSlot` satırlarını sayar.
       * Sonuç: legacy yolla yapılmış bir rezervasyon slot yolu için GÖRÜNMEZDİ,
       * yani slot yolu fiziksel dükkan kapasitesini AŞAN rezervasyon alabiliyordu.
       * Prod'da `ReservationSlot` tamamen boş (19 rezervasyona karşı 0 satır),
       * yani şu an her rezervasyon slot yolu için görünmez durumda.
       *
       * `Shop.capacity` FİZİKSEL gerçektir: dükkana kaç valiz sığdığı. Slot
       * kapasitesi onun içindeki daha ince bir dağıtımdır. İkisi birbirinin
       * yerine geçmez — fiziksel sınır her iki yolda da tutmak zorunda.
       *
       * Rezerve edilmiş pencere kullanılıyor (`checkInTime`/`checkOutTime`),
       * istenen değil: slot sınırlarına yuvarlanmış olabilir ve kaydedilen budur.
       */
      await assertCapacityTx(
        tx,
        shop,
        data.shopId,
        checkInTime,
        checkOutTime,
        newBags,
        undefined,
      );

      // Create ReservationSlot entries
      const slots = await tx.shopTimeSlot.findMany({
        where: {
          shopId: data.shopId,
          startTime: { gte: data.checkInTime },
          endTime: { lte: data.checkOutTime },
          isActive: true,
        },
      });

      const referralDiscountAmount =
        typeof data.referralDiscountAmount === 'number' && Number.isFinite(data.referralDiscountAmount)
          ? Math.max(0, data.referralDiscountAmount)
          : 0;

      const booking = await tx.booking.create({
        data: {
          guestId: data.guestId ?? null,
          guestEmail: data.guestEmail ?? null,
          guestPhone: data.guestPhone ?? null,
          // Misafirin dili: bildirimler bunu okur. Bkz. `Booking.locale`.
          locale: data.locale ?? null,
          shopId: data.shopId,
          totalPrice: data.totalPrice,
          insuranceFee,
          referralDiscountAmount,
          referredByCode: data.referredByCode ?? null,
          /*
            Kupon indirimi de referans indirimi gibi DEFTERE yaziliyor. Ikisi
            ayni olay: fiyat dusuruldu ve sebebi kayitli olmali.
          */
          couponDiscountAmount:
            typeof data.couponDiscountAmount === 'number' && Number.isFinite(data.couponDiscountAmount)
              ? Math.max(0, data.couponDiscountAmount)
              : 0,
          couponCode: data.couponCode ?? null,
          bagCountS: data.bagCountS,
          bagCountM: data.bagCountM,
          bagCountXl: data.bagCountXl,
          checkInTime,
          checkOutTime,
          unitPrice,
          pricingSnapshot: toPricingSnapshot(rules),
          qrCodeToken: `temp_${crypto.randomUUID()}`,
          status: initialStatus,
          reservationSlots: {
            create: slots.map((s) => ({
              slotId: s.id,
              bagCount: newBags,
            })),
          },
        },
      });

      const qrCodeToken = await createQrToken({
        bookingId: booking.id,
        guestId: data.guestId ?? booking.id,
        shopId: data.shopId,
      });

      return tx.booking.update({
        where: { id: booking.id },
        data: { qrCodeToken },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  ), { label: "createSlotBooking" });

  bookingEventService.record({
    bookingId: booking.id,
    event: "CREATED",
    actorId: data.guestId ?? "guest",
    actorRole: "GUEST",
    metadata: {
      shopId: data.shopId,
      totalPrice: data.totalPrice,
      slotBooking: true,
    },
  }).catch((err) => logger.error({ err, bookingId: booking.id }, "booking_event_created_failed"));

  if (initialStatus === 'APPROVED') {
    /*
      Esnaf onayi beklenmeyen akis. Olay burada yazilir ki mobil ve web ayni izi
      biraksin — 2026-08-25 oncesinde yalnizca web yaziyordu.
    */
    bookingEventService.record({
      bookingId: booking.id,
      event: 'APPROVED',
      actorId: data.guestId ?? 'guest',
      actorRole: 'GUEST',
      metadata: { autoApproved: true },
    }).catch((err) => logger.error({ err, bookingId: booking.id }, 'booking_event_approved_failed'));
  }

  return booking;
}
export async function assertCapacityTx(
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
        {
          /*
            ORTUSME -- ama RAFTA DURAN VALIZ ISTISNASI ile.

            NEDEN (2026-09-01'de olculdu): kosul `checkOutTime > yeniCheckIn`
            istiyordu. Cikis saati GECMIS ama hala `CHECKED_IN` olan bir
            rezervasyon -- yani valiz fiziksel olarak rafta duruyor ama teslim
            alinmamis -- bu kosulu SAGLAMIYOR ve kapasiteden DUSULMUYORDU.

            Gelistirme veritabaninda olculdu: Galata dukkani, kapasite 50,
            sayilan 23 valiz, GORUNMEYEN 3 valiz. Yani rafta 26 valiz varken
            sistem 23 saniyor ve 27 valiz daha kabul etmeye hazir -- oysa yalnizca
            24 yer var.

            Uretimde daha agir: `OverdueBookingService` basligindaki olcume gore
            19 rezervasyonun 18'i cikis saatini gecmis halde ACIKTI ve uc musterinin
            bavulu aylardir "dukkanda" gorunuyordu. O tabloda gorunmeyen valizler
            kapasitenin COGUNLUGU olur ve esnaf tezgahta, gercek musteri
            karsisinda yer bulamaz.

            KURAL: teslim alinmis bir valiz, GERCEKTEN teslim edilene kadar yer
            kaplar. Cikis saati bir PLANDIR, bir olgu degil.

            TAKASI ACIK: aylarca alinmayan bir valiz kapasiteyi kalici olarak
            dusurur. Bu DOGRUDUR -- raf gercekten dolu. Yanlis olan, bos
            gostermekti; esnaf icin tezgahta yer bulamamak, kacirilan bir
            rezervasyondan kotudur. Esnaf zaten gecikme uyarisi aliyor
            (`booking-reminders`) ve valizi teslim edince yer aciliyor.
          */
          OR: [
            { checkOutTime: { gt: checkInTime } },
            { AND: [{ status: 'CHECKED_IN' }, { checkOutTime: { lte: new Date() } }] },
          ],
        },
        {
          /*
            Pencere baslangici kosulu: rafta duran valizin `checkInTime`i zaten
            gecmiste oldugu icin bu kosulu her zaman saglar; normal
            rezervasyonlar icinse ortusmenin diger yarisidir.
          */
          checkInTime: { lt: checkOutTime },
        },
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
