"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { paymentService } from "@/services/PaymentService";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { computeSubMerchantShare } from "@/lib/platform-split";
import { moneyToNumber } from "@/lib/money";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import { getPaymentGateway } from "@/lib/payment-gateway";
import { isPaymentSuccess } from "@/lib/payment-status";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { notificationService } from "@/services/NotificationService";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getClientIp } from "@/lib/get-ip";

const cardSchema = z.object({
  cardHolderName: z.string().min(2).max(120),
  cardNumber: z.string().min(15).max(19),
  expireMonth: z.string().min(1).max(2),
  expireYear: z.string().min(2).max(4),
  cvc: z.string().min(3).max(4),
});

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  card: cardSchema,
});

/**
 * Esnaf onayından sonra iyzico marketplace ile karttan tahsilat (tek sayfa ödeme).
 */
export async function payBookingWithIyzicoAction(raw: unknown): Promise<
  | { success: true }
  | {
      success: false;
      errorKey: string;
      errorDetail?: string;
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, errorKey: "Errors.authRequired" };
  }
  if (!(await isPaymentsEnabled({ userId: session.user.id }))) {
    return { success: false, errorKey: "payBookingError_payments_disabled" };
  }
  if (getPaymentGateway() !== "iyzico") {
    return { success: false, errorKey: "payBookingErrorUnknown" };
  }

  const ip = await getClientIp();

  if (
    !(await rateLimit(`iyzico_pay_guest:${session.user.id}`, 25, 60 * 60 * 1000)) ||
    !(await rateLimit(`iyzico_pay_ip:${ip}`, 60, 60 * 60 * 1000))
  ) {
    return { success: false, errorKey: "payBookingError_rate_limited" };
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, errorKey: "Errors.invalidData" };
  }

  const { bookingId, card } = parsed.data;
  const strippedCard = card.cardNumber.replace(/\s/g, "");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      shop: { include: { owner: true } },
    },
  });

  if (!booking || booking.guestId !== session.user.id) {
    return { success: false, errorKey: "payBookingError_booking_not_found" };
  }

  if (booking.status !== "APPROVED" && booking.status !== "PENDING") {
    return { success: false, errorKey: "payBookingError_invalid_booking_status" };
  }

  const existingLog = await prisma.paymentLog.findUnique({
    where: { bookingId },
  });
  if (existingLog?.status === "SUCCESS") {
    return { success: false, errorKey: "payBookingError_already_paid" };
  }

  if (!booking.shop.subMerchantKey?.trim()) {
    return { success: false, errorKey: "payBookingError_iyzico_submerchant" };
  }

  const totalPrice = moneyToNumber(booking.totalPrice);
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    return { success: false, errorKey: "payBookingError_invalid_amount" };
  }

  const subMerchantPrice = computeSubMerchantShare(totalPrice);
  const guest = booking.guest;
  const buyerName = guest?.name?.trim() || "Misafir";
  const buyerEmail = guest?.email?.trim() ?? "";
  if (!buyerEmail) {
    return { success: false, errorKey: "payBookingError_guest_email_required" };
  }

  const addr = booking.shop.address?.trim() || "Istanbul";
  const cityGuess =
    addr.includes(",") ? addr.split(",").pop()!.trim() : "Istanbul";

  const result = await paymentService.initializeMarketplacePayment({
    bookingId,
    totalPrice,
    subMerchantKey: booking.shop.subMerchantKey.trim(),
    subMerchantPrice,
    card: {
      cardHolderName: card.cardHolderName.trim(),
      cardNumber: strippedCard,
      expireMonth: card.expireMonth.padStart(2, "0"),
      expireYear:
        card.expireYear.length === 2 ? `20${card.expireYear}` : card.expireYear,
      cvc: card.cvc,
    },
    buyer: {
      id: booking.guestId,
      name: buyerName,
      email: buyerEmail,
      phone: guest?.phone ?? undefined,
    },
    ip,
    shopLocation: {
      city: cityGuess,
      address: addr,
    },
  });

  if (isPaymentSuccess(result.status)) {
    // Partner + admin SMS
    void notificationService
      .notifyPartnerAndAdminsForNewPaidBooking({
        bookingId,
        shopName: booking.shop.name,
        partnerPhone: booking.shop.owner?.phone,
        totalPrice,
      })
      .catch(() => {});

    // Misafire ödeme onay e-postası
    if (buyerEmail) {
      const locale = await getLocale().catch(() => "tr");
      void notificationService
        .notifyBookingSuccess(buyerEmail, bookingId, totalPrice, locale)
        .catch(() => {});
    }

    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales(`/bookings/${bookingId}`);
    return { success: true };
  }

  const msg =
    typeof result.errorMessage === "string"
      ? result.errorMessage
      : typeof result.errorCode === "string"
        ? result.errorCode
        : undefined;

  return {
    success: false,
    errorKey: "payBookingError_iyzico_failed",
    errorDetail: msg,
  };
}
