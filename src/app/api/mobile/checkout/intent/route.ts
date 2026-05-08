import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { paymentService } from "@/services/PaymentService";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { getPaymentGateway } from "@/lib/payment-gateway";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import logger from "@/lib/logger";
import prisma from "@/lib/db";

const schema = z.object({
  shopId: z.string().uuid(),
  checkInTime: z.string().datetime(),
  checkOutTime: z.string().datetime(),
  bagCountS: z.number().int().min(0).max(20),
  bagCountM: z.number().int().min(0).max(20),
  bagCountXl: z.number().int().min(0).max(20),
});

/**
 * Dev/test bypass: when MOBILE_PAYMENT_BYPASS=true, skip the real payment
 * provider, mark the booking PAID directly, and let the mobile client walk
 * through downstream flows (booking detail, partner check-in, etc.).
 *
 * Hard guard: refuse to bypass in production unless an explicit prod flag
 * is also set. This stays opt-in twice so a stray env doesn't ship a free
 * checkout to real users.
 */
function isPaymentBypassEnabled(): boolean {
  const bypass = process.env.MOBILE_PAYMENT_BYPASS === "true";
  if (!bypass) return false;
  if (process.env.NODE_ENV === "production") {
    return process.env.MOBILE_PAYMENT_BYPASS_ALLOW_PROD === "true";
  }
  return true;
}

/**
 * Mobile birleşik checkout: booking oluştur + Stripe PaymentIntent döndür.
 * Not: Web akışı WAITING_APPROVAL → esnaf onayı → ödeme. Mobilde MVP için
 * doğrudan PAID akışı kullan. Esnaf onayı gerekiyorsa feature-flag ile kapat.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });

  const { shopId, bagCountS, bagCountM, bagCountXl } = parsed.data;
  const checkInTime = new Date(parsed.data.checkInTime);
  const checkOutTime = new Date(parsed.data.checkOutTime);

  if (bagCountS + bagCountM + bagCountXl === 0) {
    return NextResponse.json({ error: "no_bags" }, { status: 400 });
  }

  const bypass = isPaymentBypassEnabled();

  // When real payments are required, validate gateway + keys BEFORE creating
  // the booking. Otherwise we'd persist an orphan PENDING row and the UI
  // would wrongly show success without a real charge.
  if (!bypass) {
    if (!(await isPaymentsEnabled({ userId: auth.user.id }))) {
      return NextResponse.json({ error: "payments_disabled" }, { status: 503 });
    }
    if (getPaymentGateway() !== "stripe") {
      return NextResponse.json({ error: "gateway_not_stripe" }, { status: 503 });
    }
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
    }
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop?.isActive) return NextResponse.json({ error: "shop_not_found" }, { status: 404 });

  const rules = await getPricingRules();
  const totals = computeAuthoritativeCheckoutTotals(
    Number(shop.pricePerDay),
    bagCountS,
    bagCountM,
    bagCountXl,
    checkInTime,
    checkOutTime,
    rules,
  );

  const booking = await bookingService.createInitialBooking({
    guestId: auth.user.id,
    shopId,
    totalPrice: totals.subtotalBeforeCoupon,
    unitPrice: totals.unitPrice,
    insuranceFee: totals.insuranceFee,
    bagCountS: totals.bagCountS,
    bagCountM: totals.bagCountM,
    bagCountXl: totals.bagCountXl,
    checkInTime,
    checkOutTime,
  });

  if (bypass) {
    const txId = `bypass_${booking.id}_${Date.now()}`;
    await prisma.$transaction(async (tx) => {
      await tx.paymentLog.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          transactionId: txId,
          amount: totals.subtotalBeforeCoupon,
          status: "SUCCESS",
        },
        update: {
          transactionId: txId,
          amount: totals.subtotalBeforeCoupon,
          status: "SUCCESS",
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "PAID" },
      });
    });
    logger.warn(
      { bookingId: booking.id, guestId: auth.user.id, amount: totals.subtotalBeforeCoupon },
      "mobile_checkout_payment_bypassed",
    );
    return NextResponse.json({
      bookingId: booking.id,
      bypassed: true,
      totalPrice: totals.subtotalBeforeCoupon,
    });
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "PENDING" } });

  const intent = await paymentService.createStripePaymentIntentForGuestBooking({
    bookingId: booking.id,
    guestId: auth.user.id,
  });

  if (!intent.ok) {
    // Roll back orphan booking so DB does not accumulate fake-pending rows.
    await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
    const status = intent.errorCode === "stripe_error" ? 502 : 503;
    return NextResponse.json({ error: intent.errorCode }, { status });
  }

  return NextResponse.json({
    bookingId: booking.id,
    clientSecret: intent.clientSecret,
    paymentIntentId: intent.paymentIntentId,
    totalPrice: totals.subtotalBeforeCoupon,
  });
}
