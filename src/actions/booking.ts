"use server";

import { auth } from "@/auth";
import {
  bookingService,
  BookingCapacityExceededError,
} from "@/services/BookingService";
import { paymentService } from "@/services/PaymentService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { isPaymentSuccess } from "@/lib/payment-status";
import { computeSubMerchantShare } from "@/lib/platform-split";
import logger from "@/lib/logger";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { moneyToNumber } from "@/lib/money";
import type { PrismaClient } from "@prisma/client";

/** İnteraktif transaction istemcisi (Prisma.TransactionClient ile uyumlu). */
type PrismaTransactionClient = Omit<
  PrismaClient,
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
 * Rezervasyon + iyzico marketplace ödeme (tek akış).
 */
export async function createBookingAction(data: CreateBookingInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false as const, error: "Oturum açmanız gerekiyor." };
  }

  const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
  if (!shop) {
    return { success: false as const, error: "Dükkan bulunamadı." };
  }
  if (!shop.subMerchantKey) {
    return { success: false as const, error: "Bu dükkan için ödeme (subMerchant) yapılandırması eksik." };
  }

  const checkInTime = new Date(data.checkInTime);
  const checkOutTime = new Date(data.checkOutTime);

  const authTotals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(shop.pricePerDay),
    data.bagCountS,
    data.bagCountM,
    data.bagCountXl,
    checkInTime,
    checkOutTime
  );

  if (authTotals.subtotalBeforeCoupon <= 0) {
    return {
      success: false as const,
      error: "Geçerli bir hizmet tutarı için en az bir valiz ve tarih seçin.",
    };
  }

  let totalPrice = authTotals.subtotalBeforeCoupon;
  let couponId: string | undefined;

  if (data.couponCode?.trim()) {
    const code = data.couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    const now = new Date();
    if (
      coupon?.isActive &&
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

  if (process.env.NODE_ENV === "development" && data.totalPrice != null) {
    const drift = Math.abs(data.totalPrice - authTotals.subtotalBeforeCoupon);
    if (drift > 0.02) {
      logger.warn(
        { clientTotal: data.totalPrice, serverTotal: authTotals.subtotalBeforeCoupon },
        "checkout_client_total_mismatch_ignored"
      );
    }
  }

  let booking;
  try {
    booking = await bookingService.createInitialBooking({
      guestId: session.user.id,
      shopId: data.shopId,
      totalPrice,
      insuranceFee: authTotals.insuranceFee,
      bagCountS: authTotals.bagCountS,
      bagCountM: authTotals.bagCountM,
      bagCountXl: authTotals.bagCountXl,
      checkInTime,
      checkOutTime,
      unitPrice: moneyToNumber(shop.pricePerDay) || 50,
    });
  } catch (e: unknown) {
    if (e instanceof BookingCapacityExceededError) {
      return { success: false as const, error: e.message };
    }
    console.error("createInitialBooking", e);
    return { success: false as const, error: "Rezervasyon oluşturulamadı." };
  }

  const subMerchantPrice = computeSubMerchantShare(totalPrice);

  try {
    const paymentResult = await paymentService.initializeMarketplacePayment({
      bookingId: booking.id,
      totalPrice,
      subMerchantKey: shop.subMerchantKey,
      subMerchantPrice,
      card: data.cardInfo,
      buyer: {
        id: session.user.id,
        name: session.user.name || "Misafir",
        email: session.user.email || "guest@emanetci.local",
        phone: (session.user as { phone?: string }).phone,
      },
    });

    if (!isPaymentSuccess(paymentResult.status)) {
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
      return { success: false as const, error: "Ödeme başarısız veya reddedildi." };
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "PAID" },
      });
      if (couponId) {
        const affected = await tx.$executeRawUnsafe(
          `UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = $1::uuid AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`,
          couponId
        );
        if (Number(affected) !== 1) {
          logger.warn(
            { couponId, bookingId: booking.id },
            "coupon_increment_atomic_failed_or_exhausted"
          );
        }
      }
    });

    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });

    void notificationService
      .notifyBookingSuccess(
        session.user.email || session.user.id,
        booking.id,
        totalPrice
      )
      .catch(() => {});

    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales("/search");
    return {
      success: true as const,
      bookingId: booking.id,
      qrCodeToken: fresh?.qrCodeToken ?? booking.qrCodeToken,
    };
  } catch (e: unknown) {
    console.error("payment flow", e);
    await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
    return { success: false as const, error: "Ödeme sırasında hata oluştu." };
  }
}

export async function cancelBookingAction(bookingId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  const booking = await bookingService.getBookingDetails(bookingId);

  if (!booking) {
    return { success: false, error: "Rezervasyon bulunamadı." };
  }

  if (booking.guestId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Bu işlem için yetkiniz yok." };
  }

  try {
    const success = await bookingService.cancelBooking(bookingId);

    if (success) {
      revalidatePathAllLocales("/bookings");
      revalidatePathAllLocales("/admin");
      return { success: true };
    } else {
      return { success: false, error: "İptal işlemi sırasında bir hata oluştu." };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
    return { success: false, error: message };
  }
}
