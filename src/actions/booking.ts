"use server";

import { auth } from "@/auth";
import {
  bookingService,
  BookingCapacityExceededError,
} from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { BookingStatus } from "@prisma/client";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { rateLimit } from "@/lib/rate-limit";

/** İnteraktif transaction istemcisi. */
import type { Prisma } from "@prisma/client";
type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

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
  cardInfo: {
    cardHolderName: string;
    cardNumber: string;
    expireMonth: string;
    expireYear: string;
    cvc: string;
  };
  couponCode?: string;
};

/**
 * Rezervasyon Talebi (Yeni Akış).
 * Artık doğrudan ödeme alınmıyor, esnaf onayına (WAITING_APPROVAL) düşüyor.
 */
export async function createBookingAction(data: CreateBookingInput) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  if (!(await rateLimit(`booking_create:${ip}`, 10, 10 * 60 * 1000))) {
    return { success: false as const, error: "Errors.tooManyRequests" };
  }

  const session = await auth();

  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }

  const pricingRules = await getPricingRules();
  const shop = await prisma.shop.findUnique({
    where: { id: data.shopId },
    include: { owner: true },
  });

  if (!shop || !shop.isActive) {
    return { success: false as const, error: "Errors.shopNotFound" };
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
  let couponId: string | undefined;

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
      couponId = coupon.id;
    }
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
    });

    // Durumu WAITING_APPROVAL yapıyoruz (Talep aşaması)
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.WAITING_APPROVAL },
    });

    const locale = await getLocale();
    
    // Esnafa bildirim gönder (Yeni Talep)
    void notificationService
      .notifyPartnerAndAdminsForNewPaidBooking({
        bookingId: booking.id,
        shopName: shop.name,
        partnerPhone: shop.owner.phone,
        totalPrice,
      })
      .catch(() => {});

    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales("/search");

    return {
      success: true as const,
      bookingId: booking.id,
      qrCodeToken: booking.qrCodeToken,
      status: "WAITING_APPROVAL",
    };
  } catch (e: unknown) {
    if (e instanceof BookingCapacityExceededError) {
      return { success: false as const, error: e.message };
    }
    console.error("createBookingAction", e);
    return { success: false as const, error: "Errors.generic" };
  }
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
      return { success: true };
    }
    return { success: false, error: result.message };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
    return { success: false, error: message };
  }
}
