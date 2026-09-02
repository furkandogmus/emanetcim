"use server";

import { auth } from "@/auth";
import { bookingService, awardLoyaltyPoints } from "@/services/BookingService";
import {
  BookingRejectedError,
  type BookingRejectionCode,
} from "@/services/booking/errors";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { actionErrorKey } from "@/lib/action-error";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import {
  computeAuthoritativeCheckoutTotals,
  validateBookingStayWindow,
} from "@/lib/booking-server-price";
import { bookingTouchesPlatformHoliday } from "@/lib/booking-holidays";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { BookingStatus } from "@prisma/client";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import { getLocale } from "next-intl/server";
import logger from "@/lib/logger";
import { couponService } from "@/services/CouponService";
import { requireUser } from "@/lib/action-auth";
import type {
  CancelBookingErrorCode,
  ModifyBookingErrorCode,
} from "@/types/partner-booking";

export type CreateBookingInput = {
  shopId: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  unitPrice: number;
  totalPrice: number;
  insuranceFee?: number;
  checkInTime: Date;
  checkOutTime: Date;
  couponCode?: string;
  referralCode?: string;
  /** Guest checkout: accountsız kullanıcılar için e-posta */
  guestEmail?: string;
  /** Guest checkout: accountsız kullanıcılar için telefon */
  guestPhone?: string;
  /** Time-slot based: slot IDs to reserve */
  slotIds?: string[];
};

/**
 * Rezervasyon Talebi (Yeni Akış).
 * Artık doğrudan ödeme alınmıyor, esnaf onayına (WAITING_APPROVAL) düşüyor.
 */
export async function createBookingAction(data: CreateBookingInput) {
  await headers();
  const ip = await getClientIp();

  if (!(await rateLimit(`booking_create:${ip}`, 10, 10 * 60 * 1000))) {
    return { success: false as const, error: "Errors.tooManyRequests" };
  }

  const session = await auth();
  const userId = session?.user?.id;
  const isGuest = !userId;

  // Guest checkout validation
  if (isGuest && !data.guestEmail && !data.guestPhone) {
    return { success: false as const, error: "Errors.guestContactRequired" };
  }

  if (isGuest) {
    if (data.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.guestEmail)) {
      return { success: false as const, error: "Errors.invalidEmail" };
    }
    if (data.guestPhone && data.guestPhone.trim().length < 10) {
      return { success: false as const, error: "Errors.invalidPhone" };
    }
  }

  // Per-user rate limit (IP spoofing'e karşı ek koruma)
  if (userId && !(await rateLimit(`booking_create_user:${userId}`, 5, 5 * 60 * 1000))) {
    return { success: false as const, error: "Errors.tooManyRequests" };
  }

  const pricingRules = await getPricingRules();
  const shop = await prisma.shop.findUnique({
    where: { id: data.shopId },
    /*
      DAR SECIM (2026-08-31): `owner: true` tam `User` satirini getiriyordu
      (`passwordHash` ve MB'lik base64 `image` dahil); bu akisin okudugu tek
      alan `shop.owner.phone` -- esnafa gonderilen bildirim icin.
    */
    include: { owner: { select: { id: true, phone: true, email: true, name: true } } },
  });

  /*
    ISLETILME KONTROLU (2026-08-31'de siklastirildi).

    Onceki kosul yalnizca `!shop.isActive` idi. `PUBLIC_SHOP_FILTER` /
    `OPERATING_SHOP_FILTER` bu soruyu ikiye ayirmis ve gerekcesini
    `public-shop-filter.ts`e yazmisti:

      "misafire gosterilsin mi?"  -> PUBLIC_SHOP_FILTER   (prelaunch DAHIL)
      "burada is yapiliyor mu?"   -> OPERATING_SHOP_FILTER (prelaunch HARIC)

    Rezervasyon ikinci sorunun yaniti. Tek basina `isActive`e bakmak iki seyi
    birden kaciriyordu:

      - TEST dukkanlari (`isTest: true`) rezervasyon alabiliyordu; "test kaydi
        kamuya HIC gorunmez" kurali para yolunda deliniyordu.
      - TALEP TESTI noktalari (`isPrelaunch: true`) rezervasyon alabiliyordu --
        oysa ayni dosya "slot uretilmez, rezervasyon ALINMAZ" diyor. Bu
        noktalarda slot hic uretilmedigi icin misafir, arkasinda hicbir
        kapasitesi olmayan bir yere odeme yapmis olurdu.

    Kural artik dosyanin kendi tanimindan geliyor, elle yazilmis tek bir
    bayraktan degil.
  */
  if (!shop || !shop.isActive || shop.isTest || shop.isPrelaunch) {
    return { success: false as const, error: "Errors.shopNotFound" };
  }

  /*
    Tarih doğrulamaları burada TEKRARLANMIYOR: `createInitialBooking` ikisini de
    yapıyor ve tipli hata fırlatıyor (`BookingWindowInvalidError` /
    `BookingHolidayError`). Aşağıdaki `catch` onları kullanıcıya görünen anahtara
    çeviriyor. Eskiden pencere kontrolü iki yerde, tatil kontrolü ise YALNIZCA
    burada vardı — mobil uç tatilde rezervasyona izin veriyordu.
  */

  const authTotals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(shop.pricePerDay),
    data.bagCountS,
    data.bagCountM,
    data.bagCountXl,
    data.checkInTime,
    data.checkOutTime,
    pricingRules
  );

  let totalPrice = authTotals.subtotalBeforeCoupon;

  /*
    Kupon hakkı rezervasyon oluşmadan ÖNCE atomik olarak alınır; oluşturma
    başarısız olursa aşağıdaki `catch` bloğunda geri verilir. Kota mantığı ve
    indirim aritmetiği `CouponService`'te — para değiştiren her yol servis
    katmanından geçer (`service-layer-writes` mandalı).
  */
  let appliedCouponId: string | undefined;
  /*
    INDIRIM DEFTERE YAZILIYOR (2026-09-01). Onceden yalnizca indirilmis
    `totalPrice` kaydediliyordu; kuponun kendisinden hicbir iz kalmiyordu ve
    "bu rezervasyon neden 50 degil de 40 TRY?" sorusunun cevabi veride yoktu.
    Referans indirimi (`referralDiscountAmount`) ta bastan kaydediliyordu --
    ayni olay bir yolda denetlenebilir, digerinde gorunmezdi.
  */
  let couponDiscountAmount = 0;
  let appliedCouponCode: string | undefined;
  if (data.couponCode) {
    const claim = await couponService.claim(data.couponCode, totalPrice);
    if (claim.ok) {
      totalPrice = claim.claimed.totalPrice;
      appliedCouponId = claim.claimed.couponId;
      couponDiscountAmount = claim.claimed.discountAmount;
      appliedCouponCode = claim.claimed.code;
    }
  }

  // Referans kodu indirimi (kupon ile birlikte uygulanmaz, ikincisi işlenmez)
  let referralDiscountAmount = 0;
  let appliedReferralCode: string | undefined;
  if (data.referralCode && !data.couponCode) {
    const codeUpper = data.referralCode.trim().toUpperCase();
    const referrer = await prisma.user.findUnique({
      where: { referralCode: codeUpper },
      select: { id: true },
    });
    // Kendi kodunu kullanamaz
    if (referrer && referrer.id !== session?.user?.id) {
      const discountPct = Math.min(50, Math.max(0, Number(process.env.REFERRAL_DISCOUNT_PCT ?? "5")));
      referralDiscountAmount = Math.round(totalPrice * (discountPct / 100) * 100) / 100;
      totalPrice = Math.max(0, Math.round((totalPrice - referralDiscountAmount) * 100) / 100);
      appliedReferralCode = codeUpper;
    }
  }

  // Sıfır valizle rezervasyon oluşturulamaz
  const totalBags = authTotals.bagCountS + authTotals.bagCountM + authTotals.bagCountXl;
  if (totalBags < 1) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  /*
    Tip ACIK yaziliyor: `booking` try icinde atanip asagidaki `.catch` kapaniclarinda
    okunuyor; cikarim orada `any`e dusuyordu.
  */
  let booking: Awaited<ReturnType<typeof bookingService.createInitialBooking>>;
  try {
    booking = await bookingService.createInitialBooking({
      guestId: userId ?? null,
      guestEmail: isGuest ? (data.guestEmail ?? null) : null,
      guestPhone: isGuest ? (data.guestPhone ?? null) : null,
      shopId: data.shopId,
      totalPrice,
      bagCountS: data.bagCountS,
      bagCountM: data.bagCountM,
      bagCountXl: data.bagCountXl,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      unitPrice: authTotals.unitPrice,
      insuranceFee: authTotals.insuranceFee,
      referralDiscountAmount,
      referredByCode: appliedReferralCode,
      couponDiscountAmount,
      couponCode: appliedCouponCode,
      // Misafirin dili: rota zaten `[locale]` tasiyor, bildirimler bunu okur.
      locale: await getLocale(),
      slotIds: data.slotIds,
      /*
        Doğrudan APPROVED: esnaf onayı beklenmez. Eskiden rezervasyon `PENDING`
        yaratılıp hemen ardından ham `booking.update` ile APPROVED yapılıyordu;
        iki adım arasında süreç ölürse rezervasyon kalıcı `PENDING` kalıyordu.
        Durum artık yaratılışla aynı transaction'da; denetim izini de servis yazar.
      */
      initialStatus: BookingStatus.APPROVED,
    });

    // Misafire onay e-postası
    const recipientEmail = session?.user?.email ?? data.guestEmail;
    if (recipientEmail) {
      const locale = await getLocale();
      void notificationService
        .notifyBookingSuccess(recipientEmail, booking.id, totalPrice, locale)
        .catch((err) =>
          logger.error({ err, bookingId: booking.id }, "notify_booking_success_failed"),
        );
    }

    // Esnafa bildirim gönder (Yeni Rezervasyon)
    void notificationService
      .notifyPartnerAndAdminsForNewPaidBooking({
        bookingId: booking.id,
        shopName: shop.name,
        partnerPhone: shop.owner.phone,
        totalPrice,
      })
      .catch((err) =>
        logger.error({ err, bookingId: booking.id }, "notify_partner_admins_failed"),
      );

    // Sadakat puanı: her 1 TL harcamaya 1 puan
    if (userId) {
      const earnedPoints = Math.floor(totalPrice);
      if (earnedPoints > 0) {
        /*
          Sessizce yutulmaz. Iptal tarafi (`lifecycle.ts`) dusme hatasini zaten
          logluyordu; kazanma tarafi loglamiyordu, yani misafir puanini
          alamadiginda sebebi HICBIR yerde yazmiyordu. "Sadakat puani kazaniliyor
          ama gorunmuyor" hatasi (b069522) tam bu korlukten cikmisti.
        */
        /*
          GOVDE SERVISTE (`awardLoyaltyPoints`). `Booking` yazmalari servis
          disina kapali; ama asil sebep, puani VEREN ve GERI ALAN kodun ayni
          yerde durmasi. Ayri yerlerde oldukca biri `floor(totalPrice)` derken
          digeri baska bir sey diyebiliyordu -- nitekim oyle oldu ve misafir
          baska rezervasyonlardan kazandigi puani kaybediyordu (olculdu: 112).
        */
        void awardLoyaltyPoints({ bookingId: booking.id, guestId: userId, points: earnedPoints })
          .catch((err) =>
            logger.error({ err, userId, earnedPoints }, "loyalty_points_increment_failed"),
          );
      }
    }

    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales("/search");

    analyticsService.track({
      name: "booking_created",
      sessionId: await resolveServerSessionId(userId),
      userId: userId ?? null,
      metadata: { shopId: data.shopId, source: "web" },
    });

    return {
      success: true as const,
      bookingId: booking.id,
      qrCodeToken: booking.qrCodeToken,
      status: "APPROVED",
    };
  } catch (e: unknown) {
    // Booking oluşturulamadıysa, önceden atomik olarak alınmış kupon hakkı iade edilir.
    if (appliedCouponId) {
      await couponService.release(appliedCouponId);
    }
    /*
      Servisin REDDETME sebepleri tipli; metin DEĞİL kod taşınıyor. Eskiden burada
      `e.message` dönüyordu ve servis Türkçe cümle üretiyordu ("...kalan: 3 valiz,
      talep: 5"); `CheckoutClient` anahtar olmayan her değeri ekrana aynen bastığı
      için Japonca arayüzdeki misafir Türkçe hata okuyordu.
    */
    if (e instanceof BookingRejectedError) {
      return {
        success: false as const,
        error: BOOKING_REJECTION_TO_KEY[e.code],
      };
    }
    console.error("createBookingAction", e);
    return { success: false as const, error: "Errors.generic" };
  }
}

export type ModifyBookingActionInput = {
  bookingId: string;
  checkInTime: Date;
  checkOutTime: Date;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
};

/** Servisin rezervasyon REDDETME kodlarının çeviri anahtarı karşılıkları. */
const BOOKING_REJECTION_TO_KEY: Record<BookingRejectionCode, string> = {
  CAPACITY_EXCEEDED: "Errors.insufficientCapacity",
  INVALID_DATES: "Errors.invalidBookingDates",
  PLATFORM_HOLIDAY: "Errors.bookingIncludesPlatformHoliday",
  SHOP_PRELAUNCH: "Errors.shopNotOpenYet",
  // Sifir/negatif valiz ya da negatif tutar: istek bozuk.
  INVALID_INPUT: "Errors.invalidData",
};

const CANCEL_ERROR_TO_KEY: Record<CancelBookingErrorCode, string> = {
  NOT_FOUND: "Errors.bookingNotFound",
  INVALID_STATUS: "Errors.modificationNotAllowed",
  REFUND_FAILED: "Errors.cancelRefundFailed",
  UNKNOWN: "Errors.generic",
};

const MODIFY_ERROR_TO_KEY: Record<ModifyBookingErrorCode, string> = {
  NOT_FOUND: "Errors.bookingNotFound",
  UNAUTHORIZED: "Errors.unauthorized",
  INVALID_STATUS: "Errors.modificationNotAllowed",
  INVALID_DATES: "Errors.invalidBookingDates",
  CAPACITY: "Errors.insufficientCapacity",
  REFUND_FAILED: "Errors.modificationRefundFailed",
  PRICE_INCREASE: "Errors.modificationPriceIncrease",
  UNKNOWN: "Errors.generic",
};

export async function modifyBookingAction(data: ModifyBookingActionInput) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const pricingRules = await getPricingRules();
  const cin = new Date(data.checkInTime);
  const cout = new Date(data.checkOutTime);
  if (!validateBookingStayWindow(cin, cout, pricingRules)) {
    return { success: false as const, error: "Errors.invalidBookingDates" };
  }
  if (bookingTouchesPlatformHoliday(cin, cout, pricingRules.platformHolidayDates)) {
    return {
      success: false as const,
      error: "Errors.bookingIncludesPlatformHoliday",
    };
  }

  const result = await bookingService.modifyBooking(
    data.bookingId,
    auth.actor.id,
    {
      checkInTime: new Date(data.checkInTime),
      checkOutTime: new Date(data.checkOutTime),
      bagCountS: data.bagCountS,
      bagCountM: data.bagCountM,
      bagCountXl: data.bagCountXl,
    }
  );

  if (result.ok) {
    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales(`/bookings/${data.bookingId}`);
    return { success: true as const };
  }

  return {
    success: false as const,
    error: MODIFY_ERROR_TO_KEY[result.code] ?? "Errors.generic",
  };
}

export async function cancelBookingAction(bookingId: string) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const booking = await bookingService.getBookingDetails(bookingId);

  if (!booking) {
    return { success: false, error: "Errors.bookingNotFound" };
  }

  if (booking.guestId !== auth.actor.id && auth.actor.role !== "ADMIN") {
    return { success: false, error: "Errors.unauthorized" };
  }

  try {
    const result = await bookingService.cancelBooking(bookingId);

    if (result.ok) {
      revalidatePathAllLocales("/bookings");
      revalidatePathAllLocales("/admin");
      return {
        success: true as const,
        fullRefund: result.fullRefund,
      };
    }
    return {
      success: false as const,
      error: CANCEL_ERROR_TO_KEY[result.code] ?? "Errors.generic",
    };
  } catch (error: unknown) {
    /*
      Ham `Error.message` DÖNMEZ. Prod'da Next zaten o metni kırpıyor, geliştirmede
      ise ham anahtar sızıyordu; `BookingDetailActions` gelen değeri aynen
      bastığı için misafir "Errors.bookingNotFound" okuyordu. `actionErrorKey`
      tanınan anahtarı korur, tanımadığını `generic`e düşürür.
    */
    logger.error({ err: error }, "cancelBookingAction");
    return { success: false as const, error: `Errors.${actionErrorKey(error)}` };
  }
}
