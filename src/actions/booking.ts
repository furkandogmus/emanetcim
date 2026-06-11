"use server";

import { auth } from "@/auth";
import {
  bookingService,
  BookingCapacityExceededError,
} from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import {
  computeAuthoritativeCheckoutTotals,
  validateBookingStayWindow,
} from "@/lib/booking-server-price";
import { bookingTouchesPlatformHoliday } from "@/lib/booking-holidays";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { BookingStatus } from "@prisma/client";
import { bookingEventService } from "@/services/BookingEventService";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
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
  cardInfo?: {
    cardHolderName: string;
    cardNumber: string;
    expireMonth: string;
    expireYear: string;
    cvc: string;
  };
  couponCode?: string;
  referralCode?: string;
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

  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }

  // Per-user rate limit (IP spoofing'e karşı ek koruma)
  if (!(await rateLimit(`booking_create_user:${session.user.id}`, 5, 5 * 60 * 1000))) {
    return { success: false as const, error: "Errors.tooManyRequests" };
  }

  const pricingRules = await getPricingRules();
  const shop = await prisma.shop.findUnique({
    where: { id: data.shopId },
    include: { owner: true },
  });

  if (!shop || !shop.isActive) {
    return { success: false as const, error: "Errors.shopNotFound" };
  }

  if (
    !validateBookingStayWindow(
      new Date(data.checkInTime),
      new Date(data.checkOutTime),
      pricingRules
    )
  ) {
    return { success: false as const, error: "Errors.invalidBookingDates" };
  }

  if (
    bookingTouchesPlatformHoliday(
      new Date(data.checkInTime),
      new Date(data.checkOutTime),
      pricingRules.platformHolidayDates,
    )
  ) {
    return {
      success: false as const,
      error: "Errors.bookingIncludesPlatformHoliday",
    };
  }

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

  let appliedCouponId: string | undefined;
  if (data.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: data.couponCode },
    });
    const now = new Date();
    if (
      coupon &&
      coupon.isActive &&
      (!coupon.expiresAt || coupon.expiresAt > now) &&
      (coupon.maxUses == null || coupon.usedCount < coupon.maxUses) &&
      (coupon.minPrice == null ||
        totalPrice >= moneyToNumber(coupon.minPrice))
    ) {
      if (coupon.isPercent) {
        totalPrice = Math.max(
          0,
          Math.round(
            totalPrice * (1 - moneyToNumber(coupon.discount) / 100) * 100
          ) / 100
        );
      } else {
        totalPrice = Math.max(
          0,
          Math.round((totalPrice - moneyToNumber(coupon.discount)) * 100) / 100
        );
      }
      appliedCouponId = coupon.id;
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
    if (referrer && referrer.id !== session.user.id) {
      const discountPct = Number(process.env.REFERRAL_DISCOUNT_PCT ?? "5");
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

  let booking;
  try {
    booking = await bookingService.createInitialBooking({
      guestId: session.user.id,
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
    });

    // Booking onaylandı (doğrudan APPROVED, esnaf onayı beklenmez)
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.APPROVED },
    });

    void bookingEventService.record({
      bookingId: booking.id,
      event: "APPROVED",
      actorId: session.user.id,
      actorRole: "GUEST",
    }).catch(() => {});

    // Esnafa bildirim gönder (Yeni Rezervasyon)
    void notificationService
      .notifyPartnerAndAdminsForNewPaidBooking({
        bookingId: booking.id,
        shopName: shop.name,
        partnerPhone: shop.owner.phone,
        totalPrice,
      })
      .catch(() => {});

    // Kupon kullanıldıysa usedCount artır (atomik)
    if (appliedCouponId) {
      await prisma.coupon.update({
        where: { id: appliedCouponId },
        data: { usedCount: { increment: 1 } },
      }).catch(() => {}); // booking zaten oluştu, kupon sayacı hatayla durmamalı
    }

    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales("/search");

    return {
      success: true as const,
      bookingId: booking.id,
      qrCodeToken: booking.qrCodeToken,
      status: "APPROVED",
    };
  } catch (e: unknown) {
    if (e instanceof BookingCapacityExceededError) {
      return { success: false as const, error: e.message };
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
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }

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
    session.user.id,
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
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Errors.authRequired");
  }

  const booking = await bookingService.getBookingDetails(bookingId);

  if (!booking) {
    return { success: false, error: "Errors.bookingNotFound" };
  }

  if (booking.guestId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Errors.unauthorized" };
  }

  try {
    const result = await bookingService.cancelBooking(bookingId);

    if (result.ok) {
      revalidatePathAllLocales("/bookings");
      revalidatePathAllLocales("/admin");
      return {
        success: true as const,
        creditCode: result.creditCode,
      };
    }
    return {
      success: false as const,
      error: CANCEL_ERROR_TO_KEY[result.code] ?? "Errors.generic",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
    return { success: false as const, error: message };
  }
}
