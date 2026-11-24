/**
 * Iptal ve duzenleme: kesinti, kredi kuponu, kapasite yeniden kontrolu.
 */
import { lockedBookingDiscount } from '@/lib/app-discount';
import { retryOnWriteConflict } from '@/lib/tx-retry';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

import logger from '@/lib/logger';
import { totalBagCount } from '@/lib/bag-pricing';
import { reserveSlots, releaseSlots, SlotAvailabilityError } from '@/services/SlotService';
import { getPricingRules } from '@/lib/platform-settings';
import { moneyToNumber } from '@/lib/money';
import { CancelBookingResult, ModifyBookingResult } from '@/types/partner-booking';
import { findClosedStayDay, isClosedAtStayTimes } from '@/services/ShopScheduleService';
import { checkoutLineItems, computeAuthoritativeCheckoutTotals, validateBookingStayWindow } from '@/lib/booking-server-price';
import { bookingEventService } from '@/services/BookingEventService';
import { paymentService, type PaymentActor } from '@/services/PaymentService';
import { couponService } from '@/services/CouponService';
import { BookingCapacityExceededError } from '@/services/booking/errors';
import { assertCapacityTx } from '@/services/booking/create';
import { bookingTouchesPlatformHoliday } from '@/lib/booking-holidays';
import { createQrToken } from '@/lib/qr-token';
import { notificationService } from '@/services/NotificationService';
import type { ModifyBookingInput } from '@/services/BookingService';
import type { CancelReason } from '@/lib/booking-closure';

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
/**
 * `reason`/`note`/`detail` `CANCELLED` olayinin metadata'sina yazilir; mobil
 * `cancelReason` alani oradan okunur (`cancelReasonFromEvents`).
 */
export type CancelBookingOptions = {
  silent?: boolean;
  actor?: PaymentActor;
  reason?: CancelReason;
  /** Serbest metin aciklama (yonetici iptali, esnafin "diger" nedeni). */
  note?: string | null;
  /** Alt neden, ornegin esnafin sectigi `shop_closed`. */
  detail?: string | null;
  /**
   * Esnafa "iptal edildi" push'u. Verilmezse esnaf kaynakli nedenlerde
   * (partner_cancel, no_show) gitmez; islemi dukkan sahibi DEGIL de yonetici
   * yaptiysa cagiran `true` gecer.
   */
  notifyPartner?: boolean;
  /**
   * Iptal kilidine eklenen KOSUL. Otomatik kapanis (`late-dropoff-scan`) taramayla
   * kilit arasinda check-in ya da "Misafiri bekle" gelirse iptal etmemeli; kosul
   * ayni kosullu yazimda dogrulanir, eslesmezse `INVALID_STATUS` doner.
   */
  guard?: Prisma.BookingWhereInput;
  /** `CANCELLED` olayina eklenen alanlar (ornegin `auto: true`). */
  eventMetadata?: Record<string, unknown>;
};

export async function cancelBooking(
  bookingId: string,
  /*
    `silent`: cagiran bildirimi kendisi yonetiyor. Esnafin "reddet"i misafire
    kendi bildirimini gonderir ve esnafa "iptal edildi" demek anlamsiz; toplu
    hesap silme de yuzlerce bildirim uretmemeli. Varsayilan (misafir iptali):
    esnaf ve misafir haberdar edilir.
  */
  opts: CancelBookingOptions = {},
): Promise<CancelBookingResult> {
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

  /*
    IPTAL HAKKI ATOMIK OLARAK ALINIR (2026-09-02'de gercek veritabaninda
    olculdu).

    Yukaridaki durum kontrolu okuma-sonra-yazma: ayni rezervasyona dort es
    zamanli iptal geldiginde dordu de rezervasyonu `PAID` gorur, dordu de
    kontrolu gecer ve dordu de YAN ETKILERI calistirirdi. Olcum:

        iptal basarili: 4/4
        sadakat puani: 500 -> 100   (100 dusmeliydi, 400 dustu)
        CANCELLED olayi: 4          (bir olmaliydi)

    Misafir uc yuz puanini haksiz yere kaybediyordu. Bu, es zamanli iki
    istemci gerektirmiyor: "Iptal Et" dugmesine iki kez basmak ya da agin
    istegi tekrarlamasi yeter.

    Durum degisikligi artik KOSULLU: yalnizca rezervasyon hala iptal
    edilebilir durumdaysa geciyor ve etkilenen satir sayisi sifirsa bu cagri
    YARISI KAYBETMISTIR -- yan etkilere hic girmez. Ayni kalip kupon kotasinda
    ve (bugun) muhur atamasinda calisiyor.

    Kaybedene donen cevap, SIRALI cagridaki cevabin aynisi (`INVALID_STATUS`):
    ikinci iptal her iki durumda da ayni seyi duymali.
  */
  /*
    Bekleyen valiz onerisi de ayni kosullu yazimda silinir (bulgu 57). Iptal
    edilen rezervasyonda kalirsa misafir en ustte Onayla/Reddet karti goruyor ve
    Onayla "artik degistirilemez" diyordu; check-out da ayni alani bosaltir.
  */
  /*
    Surum de artirilir: check-in yazimi `bookingRowVersion` ile kosullu; artmazsa
    iptalden ONCE satiri okumus bir check-in, slotlari bosaltilmis ve iadesi
    yazilmis CANCELLED kaydi CHECKED_IN'e cevirebiliyordu.
  */
  const guard = opts.guard ? { AND: [opts.guard] } : {};
  const kilit = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: { notIn: ['CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'] },
      ...guard,
    },
    data: { status: 'CANCELLED', pendingBagRevision: Prisma.JsonNull, bookingRowVersion: { increment: 1 } },
  });
  if (kilit.count === 0) {
    return {
      ok: false,
      code: 'INVALID_STATUS',
      message: 'Bu rezervasyon iptal edilemez.',
    };
  }

  // Valiz hic birakilmadi: kupon hakki geri verilir (kotali kupon iptal dongusuyle bitmesin).
  if (booking.couponCode) {
    void couponService.releaseByCode(booking.couponCode).catch(() => undefined);
  }

  /*
    Kilit alindiktan sonra rezervasyon IPTAL EDILMISTIR. Yan etkilerden biri
    firlatirsa cagirana basarisizlik donmek yalan olur: istemci "iptal
    edilemedi" der, tekrar dener ve `invalid_status` alir. Her yan etki kendi
    hatasini loglar; sonuc her durumda `ok: true`.
  */
  try {
    // İade defter üzerinden. Ham `updateMany` kaldırıldı: kısmi iadeyi
    // modelleyemiyordu, `refundedAmount` yazmıyordu ve denetim izi bırakmıyordu.
    if (hadPayment) {
      const refunded = await paymentService.refund({
        bookingId,
        reason: 'booking_cancelled',
        actor: opts.actor,
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
        .cancelIntent({ bookingId, actor: opts.actor })
        .catch((err) => logger.error({ err, bookingId }, "payment_intent_cancel_failed"));
    }
  } catch (error) {
    logger.error({ err: error, bookingId }, 'cancel_booking_payment_side_effect_failed');
  }

  try {
    await prisma.$transaction(async (tx) => {
      /*
        Durum YUKARIDA atomik olarak yazildi; burada tekrar yazmak gereksiz.
        Kalan is, iptalin yan etkileri: slot defteri ve sadakat puani.
      */
      if (booking.reservationSlots.length > 0) {
        await tx.reservationSlot.deleteMany({ where: { bookingId } });
      }
    });
  } catch (error) {
    // Kapasite tutulu kalir; `consistency-check` bu ayrismayi sayar.
    logger.error({ err: error, bookingId }, 'cancel_booking_slot_release_failed');
  }

  /*
    Atesle-unut: iptal/degisiklik yazildi, olay kaydi onu bekletmez. `.catch`
    sart — yakalanmamis red sureci dusurur (`unhandled-rejection` mandali, tavan 0).
  */
  void bookingEventService.record({
    bookingId,
    event: "CANCELLED",
    actorId: opts.actor?.id ?? null,
    actorRole: opts.actor?.role ?? null,
    impersonatedBy: opts.actor?.impersonatedBy ?? null,
    metadata: {
      previousStatus: booking.status,
      hadPayment,
      fullRefund: true,
      ...(opts.reason ? { reason: opts.reason } : {}),
      ...(opts.detail ? { detail: opts.detail } : {}),
      ...(opts.note ? { note: opts.note } : {}),
      ...(opts.eventMetadata ?? {}),
    },
  }).catch((err) => logger.error({ err, bookingId }, "booking_event_cancelled_failed"));

  if (!opts.silent) {
    const reason = opts.reason ?? 'guest_cancel';
    const partnerReason = reason === 'partner_cancel' || reason === 'no_show';
    if (opts.notifyPartner ?? !partnerReason) {
      void notificationService
        .notifyPartnerBookingChange({ bookingId, kind: 'cancelled' })
        .catch((err) => logger.error({ err, bookingId }, 'notify_partner_booking_cancelled_failed'));
    }
    if (reason === 'admin_cancel') {
      void notificationService
        .notifyPartnerAdminAction({ bookingId, kind: 'cancelled', note: opts.note ?? '' })
        .catch((err) => logger.error({ err, bookingId }, 'notify_partner_admin_cancel_failed'));
    }
    void notificationService
      .notifyGuestBookingClosed({
        bookingId,
        reason,
        detail: opts.detail ?? null,
        note: opts.note ?? null,
        locale: booking.locale ?? 'tr',
      })
      .catch((err) => logger.error({ err, bookingId }, 'notify_guest_booking_closed_failed'));
  }

  return { ok: true, fullRefund: hadPayment };
}

/**
 * Misafir rezervasyonunu günceller (tarih / valiz sayıları).
 * Ödeme alınmışsa tutar düşüşünde kısmi iade; tutar artışı desteklenmez (iptal + yeniden rezervasyon).
 */
export async function modifyBooking(
  bookingId: string,
  guestId: string,
  input: ModifyBookingInput,
  /*
    `dryRun`: butun kapilar ve fiyat hesabi calisir, yazmadan once doner. Mobil
    degistirme ekrani yeni tutari KENDI formuluyle tahmin ediyordu (kilitli
    indirimi bile fark hesabiyla tahmin ederek); artik bunu gosterir.
  */
  opts: { dryRun?: boolean } = {},
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

  /*
    Platform tatili: olusturma yolu (create.ts) ve web action'i reddediyordu,
    degistirme yolu hic bakmiyordu; mobil rezervasyonu tatile tasiyabiliyordu.
    Kural artik servisin isi (iki tasiyici ayni cevabi alir).
  */
  if (
    bookingTouchesPlatformHoliday(
      input.checkInTime,
      input.checkOutTime,
      rules.platformHolidayDates,
    )
  ) {
    return {
      ok: false,
      code: 'PLATFORM_HOLIDAY',
      message: 'Rezervasyon bir platform tatiline denk geliyor.',
    };
  }
  // Kapali gun ve kapali saat AYRI kod: misafir hangisini duzeltecegini bilsin.
  if (await findClosedStayDay(booking.shopId, input.checkInTime, input.checkOutTime)) {
    return {
      ok: false,
      code: 'SHOP_CLOSED_DAY',
      message: 'Dükkan seçilen günde kapalı.',
    };
  }
  if (await isClosedAtStayTimes(booking.shopId, input.checkInTime, input.checkOutTime)) {
    return {
      ok: false,
      code: 'SHOP_CLOSED_HOURS',
      message: 'Dükkan seçilen saatte kapalı.',
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

  /*
    HAM GIRDI DOGRULAMASI (2026-09-10'da bulundu). `createInitialBooking`
    (create.ts) `assertBookingInput` ile negatif/tam-sayi-olmayan valiz
    sayisini rezervasyon OLUSTURMA aninda reddediyordu; ayni kapi
    `modifyBooking`e hic tasinmamisti. `web`in `modifyBookingAction`'i
    (`ModifyBookingActionInput`) yalniz TypeScript tipiyle kisitliydi --
    calisma zamaninda hicbir kontrol yoktu -- ve asagidaki
    `computeAuthoritativeCheckoutTotals` her alani AYRI AYRI 0'a kirpiyordu
    (`clampBagCount`). Sonuc: `bagCountXl: -50` gibi bir girdi kirpilmis
    toplamda gecerli (>=1) gorunup FIYATLANIRKEN, kapasite/slot rezervasyonu
    HAM (kirpilmemis) toplami kullaniyordu -- asagida duzeltildi, bkz.
    `newBags`.
  */
  const rawBagCounts = [input.bagCountS, input.bagCountM, input.bagCountXl];
  if (
    rawBagCounts.some(
      (n) => !Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > rules.maxBagsPerSlot,
    )
  ) {
    return {
      ok: false,
      code: 'INVALID_STATUS',
      message: 'Valiz sayısı geçersiz.',
    };
  }

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
  /*
    KUPON/REFERANS INDIRIMI KORUNUR (2026-09-10'da bulundu). Onceki hali
    `newTotal`i dogrudan `authTotals.subtotalBeforeCoupon`e esitliyordu --
    indirimsiz, ham alt toplam. `computeAuthoritativeCheckoutTotals` kupon/
    referans indirimini hic bilmiyor; rezervasyon OLUSTURULURKEN uygulanan
    indirim `Booking.couponDiscountAmount`/`referralDiscountAmount`de
    ayrica tutuluyor (create.ts). Duzenleme bu iki alani DEGISTIRMEDEN
    birakiyor ama `totalPrice`i indirimsiz tutarla eziyordu -- yani zaten
    tuketilmis bir kupon/referans kotasinin karsiligi misafirden bir daha
    (tam fiyat uzerinden) tahsil ediliyordu. Kilitli indirim tutari burada
    yeni alt toplamdan dusulur.
  */
  // Kupon, davet, araci ve uygulama indirimi kilitli (`lockedBookingDiscount`).
  const lockedDiscount = lockedBookingDiscount(booking);
  const newTotal = Math.max(
    0,
    Math.round((authTotals.subtotalBeforeCoupon - lockedDiscount) * 100) / 100
  );
  const oldTotal = moneyToNumber(booking.totalPrice);

  if (opts.dryRun) {
    return {
      ok: true,
      preview: {
        days: authTotals.stayDays,
        lines: checkoutLineItems(authTotals, rules),
        insuranceFee: authTotals.insuranceFee,
        newTotal,
        oldTotal,
        priceChangeBlocked: isPaidLike && Math.abs(newTotal - oldTotal) > 0.005,
      },
    };
  }

  if (isPaidLike && Math.abs(newTotal - oldTotal) > 0.005) {
    return {
      ok: false,
      code: 'PRICE_INCREASE',
      message:
        'Geçmiş ödeme kaydı bulunan rezervasyonun tutarı değiştirilemez.',
    };
  }

  try {
    /*
      Cakismada yeniden denenir -- olusturma yoluyla ayni gerekce
      (`@/lib/tx-retry`). Degistirme de ayni slot satirlarina yaziyor, yani
      ayni yaris burada da olusur.
    */
    await retryOnWriteConflict(() => prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "Shop" WHERE id = ${booking.shopId} FOR UPDATE`;
        const shop = await tx.shop.findUnique({
          where: { id: booking.shopId },
        });
        if (!shop) {
          throw new Error('Shop missing');
        }

        /*
          KIRPILMIŞ (authTotals) toplam kullanilir, HAM `input` degil --
          fiyatlanan/kaydedilen valiz sayisiyla fiilen rezerve edilen kapasite
          HER ZAMAN ayni sayi olsun diye (2026-09-10'da bulundu, yukaridaki
          not).
        */
        const newBags = totalBagCount(
          authTotals.bagCountS,
          authTotals.bagCountM,
          authTotals.bagCountXl
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

        /*
          SLOT DEFTERI DE TASINIR (2026-09-02'de duzeltildi).

          Buraya kadar yalnizca `Booking` guncelleniyordu: tarihler ve valiz
          sayilari yeni degerlere geciyor, `ReservationSlot` satirlari ise ESKI
          slotlara bagli kaliyordu. Iki muhasebe birden bozuluyordu:

            - Eski saatte hayalet rezervasyon: kimse gelmeyecek ama defter o
              saati dolu sayiyor -- kapasite bosa yaniyor.
            - Yeni saatte GORUNMEZ rezervasyon: slot defterinde yok (slotlar
              eskiye bagli) ve eski-yol sayimina da girmiyor, cunku o sayim
              slotu OLMAYAN kayitlari suzuyor (`reservationSlots: { none: {} }`).
              Yani dukkan o saati bir kez daha satabiliyor ve misafir valiziyle
              gelince yer yok.

          `assertCapacityTx` bunu yakalayamaz: o `Booking` tablosunu sayar,
          slot defterini degil. Iki ayri kapasite muhasebesi var ve degistirme
          yolu yanlis olanina bakiyordu.

          Once serbest birakilir, sonra yeniden rezerve edilir: `reserveSlots`
          kendi kapasite kontrolunu yapiyor ve bu sirayla rezervasyonun KENDI
          payi sayimdan zaten dusmus oluyor.
        */
        const slotluMu = await tx.reservationSlot.count({ where: { bookingId } });

        let kayitliGiris = input.checkInTime;
        let kayitliCikis = input.checkOutTime;

        if (slotluMu > 0) {
          await releaseSlots(tx, bookingId);
          const yeni = await reserveSlots(
            tx,
            booking.shopId,
            input.checkInTime,
            input.checkOutTime,
            newBags,
          );
          await tx.reservationSlot.createMany({
            data: yeni.data.map((d) => ({ ...d, bookingId })),
          });
          /*
            Kaydedilen zaman, istenen degil SLOT SINIRLARINA YUVARLANMIS olan --
            olusturma yolu da boyle yapiyor. Ikisi ayrisirsa rezervasyonun
            saati ile kapladigi slotlar birbirini tutmaz.
          */
          kayitliGiris = yeni.checkInTime;
          kayitliCikis = yeni.checkOutTime;
        }

        await tx.booking.update({
          where: { id: bookingId },
          data: {
            checkInTime: kayitliGiris,
            checkOutTime: kayitliCikis,
            // Eski birakma saatine verilmis "Misafiri bekle" yeni saatte anlamsiz.
            ...(kayitliGiris.getTime() !== booking.checkInTime.getTime() ? { lateHoldUntil: null } : {}),
            bagCountS: authTotals.bagCountS,
            bagCountM: authTotals.bagCountM,
            bagCountXl: authTotals.bagCountXl,
            unitPrice: authTotals.unitPrice,
            insuranceFee: authTotals.insuranceFee,
            totalPrice: newTotal,
            /*
              QR token'in omru check-out + 24 saat; cikis degisince yeniden
              uretilir (yoksa token eski cikisa gore bitebilir). Eski token
              imzasi gecerli oldugu surece taranir (seals/scan).
            */
            qrCodeToken: await createQrToken({
              bookingId,
              guestId: booking.guestId ?? bookingId,
              shopId: booking.shopId,
              checkOutTime: kayitliCikis.toISOString(),
            }),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    ), { label: "modifyBooking" });

    void bookingEventService.record({
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

    // Esnaf degisikligi anlik gorsun (30 sn yoklamayi beklemesin).
    void notificationService
      .notifyPartnerBookingChange({ bookingId, kind: 'modified' })
      .catch((err) => logger.error({ err, bookingId }, 'notify_partner_booking_modified_failed'));

    return { ok: true };
  } catch (error) {
    if (error instanceof BookingCapacityExceededError) {
      return {
        ok: false,
        code: 'CAPACITY',
        message: error.message,
      };
    }
    /*
      Slot defteri yeniden rezerve edilirken kapasite dolduysa bu da bir
      KAPASITE reddidir, beklenmeyen bir hata degil. Ayri tur oldugu icin
      ayrica yakalanmasi gerekiyor -- yoksa misafir "beklenmeyen bir hata"
      gorurdu ve neyi degistirecegini bilemezdi.
    */
    if (error instanceof SlotAvailabilityError) {
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
