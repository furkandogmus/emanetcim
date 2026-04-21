import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { paymentService } from "@/services/PaymentService";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
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

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "PENDING" } });

  const intent = await paymentService.createStripePaymentIntentForGuestBooking({
    bookingId: booking.id,
    guestId: auth.user.id,
  });

  if (!intent.ok) {
    return NextResponse.json({ error: intent.errorCode }, { status: 400 });
  }

  return NextResponse.json({
    bookingId: booking.id,
    clientSecret: intent.clientSecret,
    paymentIntentId: intent.paymentIntentId,
    totalPrice: totals.subtotalBeforeCoupon,
  });
}
