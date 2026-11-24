"use server";

import { bookingService } from "@/services/BookingService";
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
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { BookingStatus } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import { getLocale } from "next-intl/server";
import logger from "@/lib/logger";
import { couponService } from "@/services/CouponService";
import { checkoutDiscountService } from "@/services/CheckoutDiscountService";
import { AFFILIATE_COOKIE } from "@/services/AffiliateService";
import { requireUser, actionSession } from "@/lib/action-auth";
import { canGuestSelfCancel } from "@/services/booking/access";
import { guestCancelOptions } from "@/lib/booking-closure";
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
  /** Sunucu onizlemesinin gosterdigi toplam; verilirse ayrisan tutarla rezervasyon yazilmaz. */
  expectedTotal?: number;
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

  /*
    Yeni rezervasyon yalnizca hesapla (2026-11-23). Kapi kupon/kapasite isinden
    ONCE; asil kapi serviste (`LOGIN_REQUIRED`). `code` istemcinin giris
    penceresini acmasi icin sabit.
  */
  const session = await actionSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false as const, error: "Errors.loginRequired", code: "login_required" as const };
  }

  // Per-user rate limit (IP spoofing'e karşı ek koruma)
  if (!(await rateLimit(`booking_create_user:${userId}`, 5, 5 * 60 * 1000))) {
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

  /*
    Indirim secimi `CheckoutDiscountService`te (mobil ile ayni kural): tek
    indirim; kupon hakki rezervasyondan ONCE atomik alinir ve olusturma
    basarisiz olursa asagidaki `catch` geri verir. Araci kodu `/r/<kod>`
    linkinin biraktigi cerezden okunur; atfi servis yeniden dogrular.
  */
  const affiliateCode = (await cookies()).get(AFFILIATE_COOKIE)?.value ?? null;
  const discounts = await checkoutDiscountService.claim({
    subtotal: authTotals.subtotalBeforeCoupon,
    couponCode: data.couponCode,
    referralCode: data.referralCode,
    affiliateCode,
    guest: { userId },
  });
  const totalPrice = discounts.totalPrice;
  const appliedCouponId = discounts.couponId;

  /*
    Ekran toplami sunucudan geldiyse (araci cerezi, `previewAffiliateCheckoutAction`)
    ve hesaplanan tutar farkliysa YAZILMAZ -- mobilin 409 `price_changed` kurali.
    Misafir gordugunden farkli bir tutara onay vermis olmasin.
  */
  if (data.expectedTotal !== undefined && Math.abs(data.expectedTotal - totalPrice) > 0.005) {
    if (appliedCouponId) await couponService.release(appliedCouponId);
    return { success: false as const, error: "Errors.priceChanged" };
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
      guestId: userId,
      shopId: data.shopId,
      totalPrice,
      bagCountS: data.bagCountS,
      bagCountM: data.bagCountM,
      bagCountXl: data.bagCountXl,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      unitPrice: authTotals.unitPrice,
      insuranceFee: authTotals.insuranceFee,
      referralDiscountAmount: discounts.referralDiscountAmount,
      referredByCode: discounts.referredByCode,
      couponDiscountAmount: discounts.couponDiscountAmount,
      couponCode: discounts.couponCode,
      affiliateCode: discounts.affiliateCode,
      affiliateDiscountAmount: discounts.affiliateDiscountAmount,
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

    // Misafire onay e-postası (hesabin e-postasi; telefonla acilmis hesapta yok)
    const recipientEmail = session?.user?.email;
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

    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales("/search");

    analyticsService.track({
      name: "booking_created",
      sessionId: await resolveServerSessionId(userId),
      userId,
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
        // Erken donusle ayni sozlesme: istemci giris penceresini `code`dan acar.
        ...(e.code === "LOGIN_REQUIRED" ? { code: "login_required" as const } : {}),
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
  SHOP_CLOSED_ON_DATE: "Errors.shopClosedOnDate",
  // Sifir/negatif valiz ya da negatif tutar: istek bozuk.
  INVALID_INPUT: "Errors.invalidData",
  // Istemci bu anahtarda secimi koruyarak giris ekranina gonderir.
  LOGIN_REQUIRED: "Errors.loginRequired",
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
  PLATFORM_HOLIDAY: "Errors.bookingIncludesPlatformHoliday",
  SHOP_CLOSED_DAY: "Errors.invalidBookingDates",
  SHOP_CLOSED_HOURS: "Errors.invalidBookingDates",
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
  // Platform tatili kurali `modifyBooking`te (mobil ile ortak); burada tekrar yazilmaz.

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

  // Yonetici baskasinin rezervasyonunu `adminCancelBookingAction` ile iptal eder.
  if (!canGuestSelfCancel(booking, auth.actor)) {
    return { success: false, error: "Errors.unauthorized" };
  }

  try {
    const result = await bookingService.cancelBooking(bookingId, {
      actor: { id: auth.actor.id, role: auth.actor.role },
      ...guestCancelOptions(booking),
    });

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

/*
  DEFECT_BACKLOG D5 (2026-09-12): check-in sonrası fiyat ARTIRAN bir valiz
  düzeltmesi artık esnaftan tek başına geçmiyor — `bag-revision.ts`teki
  `GUEST_APPROVAL_REQUIRED` kapısı `pendingBagRevision`ı yazıp bekletiyor.
  Bu iki action HESAPLI misafirin onay/red yüzeyi; hesapsız (token'la giren)
  misafir için AYNI govdeyi `guest-bag-revision` API ucu kullanıyor.
*/
const BAG_REVISION_GUEST_ERROR_TO_KEY: Record<string, string> = {
  NOT_FOUND: "Errors.bookingNotFound",
  FORBIDDEN: "Errors.unauthorized",
  INVALID_STATUS: "Errors.bookingStateConflict",
  NO_PENDING_REVISION: "Errors.invalidData",
  CAPACITY_EXCEEDED: "Errors.insufficientCapacity",
  SEAL_COUNT_MISMATCH: "Errors.sealCountMismatch",
  INVALID_COUNTS: "Errors.invalidData",
  GUEST_APPROVAL_REQUIRED: "Errors.bagRevisionNeedsGuestApproval",
  UNKNOWN: "Errors.generic",
};

async function loadOwnedBookingForGuest(bookingId: string, guestId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, guestId: true },
  });
  if (!booking) return { ok: false as const, error: "Errors.bookingNotFound" };
  if (booking.guestId !== guestId) return { ok: false as const, error: "Errors.unauthorized" };
  return { ok: true as const };
}

/** Bekleyen valiz düzeltmesini ONAYLAR — yeni tutar hemen uygulanır. */
export async function approveBagRevisionAction(bookingId: string) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const owned = await loadOwnedBookingForGuest(bookingId, auth.actor.id);
  if (!owned.ok) return { success: false as const, error: owned.error };

  const result = await bookingService.applyBagRevision(bookingId, {
    id: auth.actor.id,
    role: "GUEST",
  });
  if (!result.ok) {
    return {
      success: false as const,
      error: BAG_REVISION_GUEST_ERROR_TO_KEY[result.code] ?? "Errors.generic",
    };
  }

  revalidatePathAllLocales("/bookings");
  revalidatePathAllLocales(`/bookings/${bookingId}`);
  return { success: true as const, newTotal: result.newTotal };
}

/** Bekleyen valiz düzeltmesini REDDEDER — öneri silinir, rezervasyona dokunulmaz. */
export async function rejectBagRevisionAction(bookingId: string) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const owned = await loadOwnedBookingForGuest(bookingId, auth.actor.id);
  if (!owned.ok) return { success: false as const, error: owned.error };

  const result = await bookingService.clearBagRevision(bookingId, {
    id: auth.actor.id,
    role: "GUEST",
  });
  if (!result.ok) {
    return {
      success: false as const,
      error: BAG_REVISION_GUEST_ERROR_TO_KEY[result.code] ?? "Errors.generic",
    };
  }

  revalidatePathAllLocales("/bookings");
  revalidatePathAllLocales(`/bookings/${bookingId}`);
  return { success: true as const };
}
