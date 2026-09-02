import { resolveRequestLocale } from "@/lib/request-locale";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { BookingRejectedError, type BookingRejectionCode } from "@/services/booking/errors";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { BookingStatus } from "@prisma/client";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";

/**
 * Servisin rezervasyon REDDETME kodlarinin HTTP karsiliklari.
 *
 * 2026-08-25 oncesinde bu uc hicbirini yakalamiyordu: gecersiz bir tarih araligi
 * `createInitialBooking`'in tipsiz Turkce hatasini firlatiyor ve istemciye HTTP 500
 * donuyordu. Platform tatili kontrolu ise yalnizca web action'indaydi, yani ayni
 * tarih web'de reddedilirken mobilde KABUL EDILIYORDU.
 */
const REJECTION_TO_HTTP: Record<BookingRejectionCode, { status: number; error: string }> = {
  CAPACITY_EXCEEDED: { status: 409, error: "insufficient_capacity" },
  INVALID_DATES: { status: 400, error: "invalid_dates" },
  PLATFORM_HOLIDAY: { status: 400, error: "platform_holiday" },
  // 409: istek gecerli ama kaynagin SU ANKI durumu kabul etmiyor. Nokta hizmete
  // acildiginda ayni istek calisir; 400 "istegin bozuk" demek olurdu.
  SHOP_PRELAUNCH: { status: 409, error: "shop_not_open_yet" },
};

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
  /*
    Web `createBookingAction` ile AYNI kosul (2026-08-31). Onceden yalnizca
    `isActive`e bakiyordu, yani hem TEST dukkanlarina hem de isletilmeyen TALEP
    TESTI noktalarina rezervasyon acilabiliyordu. Gerekcesi
    `public-shop-filter.ts`te: prelaunch noktalarinda slot hic uretilmiyor.
  */
  if (!shop?.isActive || shop.isTest || shop.isPrelaunch) {
    return NextResponse.json({ error: "shop_not_found" }, { status: 404 });
  }

  const checkInTime = new Date(parsed.data.checkInTime);
  const checkOutTime = new Date(parsed.data.checkOutTime);
  const rules = await getPricingRules();
  const totals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(shop.pricePerDay),
    bagCountS,
    bagCountM,
    bagCountXl,
    checkInTime,
    checkOutTime,
    rules,
  );

  let booking;
  try {
    booking = await bookingService.createInitialBooking({
      guestId: auth.user.id,
      shopId,
      /*
        Mobil istemci dilini yalnizca bu baslikta bildiriyor. Web'de karsiligi
        `getLocale()` -- orada rota zaten `[locale]` tasiyor.
      */
      locale: resolveRequestLocale(req.headers.get("accept-language")),
      totalPrice: totals.subtotalBeforeCoupon,
      unitPrice: totals.unitPrice,
      insuranceFee: totals.insuranceFee,
      bagCountS: totals.bagCountS,
      bagCountM: totals.bagCountM,
      bagCountXl: totals.bagCountXl,
      checkInTime,
      checkOutTime,
      /*
        Web `createBookingAction` ile AYNI sozlesme. Eskiden burada ham
        `booking.update({ status: "APPROVED" })` vardi ve web'den farkli olarak
        denetim izine onay olayi HIC yazilmiyordu — mobil rezervasyonlarin onay
        izi yoktu. Ikisi de artik servisin isi.
      */
      initialStatus: BookingStatus.APPROVED,
    });
  } catch (e) {
    if (e instanceof BookingRejectedError) {
      const { status, error } = REJECTION_TO_HTTP[e.code];
      return NextResponse.json({ error }, { status });
    }
    throw e;
  }

  /*
    Bildirimler ATEŞLE-UNUT: rezervasyon zaten yazıldı, e-posta gecikmesi
    yanıtı bekletmemeli. Ama `.catch` ŞART — yakalanmamış bir promise reddi
    Node'da varsayılan olarak SÜRECİ DÜŞÜRÜR. Yani sağlayıcı kaynaklı bir
    bildirim hatası, ödeme ucunu komple çökertebilirdi. Dosyanın geri kalanı ve
    `NotificationService` zaten bu kalıbı kullanıyor; burada iki çağrı dışarıda
    kalmıştı.
  */
  if (auth.user.email) {
    void notificationService
      .notifyBookingSuccess(
        auth.user.email,
        booking.id,
        totals.subtotalBeforeCoupon,
      )
      .catch((err) =>
        logger.error(
          { err, bookingId: booking.id },
          "mobile_checkout_booking_success_notify_failed",
        ),
      );
  }
  analyticsService.track({
    name: "booking_created",
    sessionId: `user:${auth.user.id}`,
    userId: auth.user.id,
    metadata: { shopId, source: "mobile" },
  });

  void notificationService
    .notifyPartnerAndAdminsForNewPaidBooking({
      bookingId: booking.id,
      shopName: shop.name,
      partnerPhone: shop.owner.phone,
      totalPrice: totals.subtotalBeforeCoupon,
    })
    .catch((err) =>
      logger.error(
        { err, bookingId: booking.id },
        "mobile_checkout_partner_notify_failed",
      ),
    );

  return NextResponse.json({
    bookingId: booking.id,
    status: "APPROVED",
    totalPrice: totals.subtotalBeforeCoupon,
  });
}
