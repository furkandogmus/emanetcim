"use server";

import { auth } from "@/auth";
import { bookingService } from "@/services/BookingService";
import { paymentService } from "@/services/PaymentService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { isPaymentSuccess } from "@/lib/payment-status";
import { computeSubMerchantShare } from "@/lib/platform-split";

export type CreateBookingInput = {
  shopId: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  unitPrice: number;
  totalPrice: number;
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

  let totalPrice = data.totalPrice;
  let couponId: string | undefined;

  if (data.couponCode?.trim()) {
    const code = data.couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    const now = new Date();
    if (
      coupon?.isActive &&
      (!coupon.expiresAt || coupon.expiresAt > now) &&
      (coupon.maxUses == null || coupon.usedCount < coupon.maxUses) &&
      (coupon.minPrice == null || totalPrice >= coupon.minPrice)
    ) {
      if (coupon.isPercent) {
        totalPrice = Math.max(0, Math.round(totalPrice * (1 - coupon.discount / 100) * 100) / 100);
      } else {
        totalPrice = Math.max(0, Math.round((totalPrice - coupon.discount) * 100) / 100);
      }
      couponId = coupon.id;
    }
  }

  const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
  if (!shop) {
    return { success: false as const, error: "Dükkan bulunamadı." };
  }
  if (!shop.subMerchantKey) {
    return { success: false as const, error: "Bu dükkan için ödeme (subMerchant) yapılandırması eksik." };
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
      checkInTime: new Date(data.checkInTime),
      checkOutTime: new Date(data.checkOutTime),
      unitPrice: data.unitPrice,
    });
  } catch (e: unknown) {
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

    await bookingService.markAsPaid(booking.id);

    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

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
