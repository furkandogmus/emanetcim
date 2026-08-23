import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import prisma from "@/lib/db";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";

const schema = z.object({
  shopId: z.string().uuid(),
  checkInTime: z.string().datetime(),
  checkOutTime: z.string().datetime(),
  bagCountS: z.number().int().min(0).max(20),
  bagCountM: z.number().int().min(0).max(20),
  bagCountXl: z.number().int().min(0).max(20),
});

/** Mobil checkout: sağlayıcısız rezervasyon oluşturur ve doğrudan onaylar. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { shopId, bagCountS, bagCountM, bagCountXl } = parsed.data;
  if (bagCountS + bagCountM + bagCountXl === 0) {
    return NextResponse.json({ error: "no_bags" }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { owner: { select: { phone: true } } },
  });
  if (!shop?.isActive) {
    return NextResponse.json({ error: "shop_not_found" }, { status: 404 });
  }

  const checkInTime = new Date(parsed.data.checkInTime);
  const checkOutTime = new Date(parsed.data.checkOutTime);
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

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "APPROVED" },
  });

  if (auth.user.email) {
    void notificationService.notifyBookingSuccess(
      auth.user.email,
      booking.id,
      totals.subtotalBeforeCoupon,
    );
  }
  analyticsService.track({
    name: "booking_created",
    sessionId: `user:${auth.user.id}`,
    userId: auth.user.id,
    metadata: { shopId, source: "mobile" },
  });

  void notificationService.notifyPartnerAndAdminsForNewPaidBooking({
    bookingId: booking.id,
    shopName: shop.name,
    partnerPhone: shop.owner.phone,
    totalPrice: totals.subtotalBeforeCoupon,
  });

  return NextResponse.json({
    bookingId: booking.id,
    status: "APPROVED",
    totalPrice: totals.subtotalBeforeCoupon,
  });
}
