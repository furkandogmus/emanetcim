"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { paymentService } from "@/services/PaymentService";
import { getStripe } from "@/lib/stripe";

/**
 * Ödeme başarılı olduktan sonra (redirect olmadan) PAID + PaymentLog senkronu.
 * Webhook ile idempotent; misafir hemen detay görebilsin diye istemciden tetiklenir.
 */
export async function finalizeStripeBookingPaymentAction(paymentIntentId: string): Promise<{
  ok: boolean;
  errorCode?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, errorCode: "auth" };
  }
  if (!paymentIntentId?.trim()) {
    return { ok: false, errorCode: "missing_intent" };
  }

  try {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId.trim());
    const bookingId = pi.metadata?.bookingId?.trim();
    if (!bookingId) {
      return { ok: false, errorCode: "metadata" };
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.guestId !== session.user.id) {
      return { ok: false, errorCode: "forbidden" };
    }

    const meta =
      pi.metadata && typeof pi.metadata === "object"
        ? (pi.metadata as Record<string, string>)
        : undefined;

    const result = await paymentService.confirmStripePaymentIntentSucceeded({
      id: pi.id,
      status: pi.status,
      metadata: meta,
    });

    return { ok: result.success };
  } catch {
    return { ok: false, errorCode: "stripe_error" };
  }
}
