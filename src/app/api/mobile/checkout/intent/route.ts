import { snapStayToShopHours } from "@/lib/stay-days";
import { loadScheduleParts } from "@/services/ShopScheduleService";
import { toDatetimeLocalValueInTimeZone } from "@/lib/datetime-local";
import { couponService } from "@/services/CouponService";
import { checkoutDiscountService } from "@/services/CheckoutDiscountService";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestLocale } from "@/lib/request-locale";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { bagCountsFitRules, computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import {
  BookingIdempotentReplayError,
  BookingRejectedError,
  type BookingRejectionCode,
} from "@/services/booking/errors";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { BookingStatus } from "@prisma/client";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";
import { isShopBookableBy } from "@/lib/public-shop-filter";

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
  SHOP_CLOSED_ON_DATE: { status: 409, error: "shop_closed_on_date" },
  // 400: istegin kendisi bozuk (sifir/negatif valiz, negatif tutar).
  INVALID_INPUT: { status: 400, error: "invalid_data" },
  // Mobil checkout hep oturumlu (`requireMobileUser`); servis kapisi yine de 401 karsiligini bilir.
  LOGIN_REQUIRED: { status: 401, error: "login_required" },
};

const schema = z.object({
  shopId: z.string().uuid(),
  checkInTime: z.string().datetime(),
  checkOutTime: z.string().datetime(),
  bagCountS: z.number().int().min(0).max(20),
  bagCountM: z.number().int().min(0).max(20),
  bagCountXl: z.number().int().min(0).max(20),
  /*
    KUPON KODU (2026-09-02'de eklendi).

    Mobil istemci bu alani ZATEN GONDERIYORDU
    (`mobile/lib/features/checkout/checkout_screen.dart`), ama sema onu
    tanimlamadigi icin zod sessizce ATIYORDU ve ucta kuponu isleyen tek satir
    yoktu. Sonuc: misafir kupon kodunu girer, uygulandigini sanir ve TAM FIYAT
    oder. Web'de ayni kupon calisiyordu -- ayni is kurali iki tasiyicidan
    yalnizca birinde vardi ve aradaki fark PARAYDI.
  */
  couponCode: z.string().trim().min(1).max(64).optional(),
  /** Davet kodu (2026-09-23). Kural `ReferralService`te; web ile ayni cagri. */
  referralCode: z.string().trim().min(1).max(32).optional(),
  /** Araci kodu (2026-11-23): odeme ekranindaki "Referans kodu" ya da `?aff=` derin baglantisi. */
  affiliateCode: z.string().trim().min(1).max(40).optional(),
  /*
    Ekranda gosterilen toplam (`checkout/quote`). Sunucunun hesapladigi tutar
    bundan farkliysa (kupon kotasi bitti, davet kodu gecmez, fiyat kurali
    degisti) rezervasyon YAZILMAZ: misafir gordugunden farkli bir tutara
    onay vermis olmasin. Eski istemci gondermez; o zaman kontrol atlanir.
  */
  expectedTotal: z.number().min(0).max(1_000_000).optional(),
});

/** `Idempotency-Key`: istemci UUID'si; baska bicim reddedilir (anahtar indekse girer). */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,80}$/;

/** Basarili (ya da tekrar edilen) rezervasyonun yaniti: iki yol ayni govdeyi doner. */
function bookingResponse(b: {
  id: string;
  status: BookingStatus;
  totalPrice: unknown;
  checkInTime: Date;
  checkOutTime: Date;
}) {
  return NextResponse.json({
    bookingId: b.id,
    status: b.status,
    totalPrice: moneyToNumber(b.totalPrice),
    checkInTime: b.checkInTime.toISOString(),
    checkOutTime: b.checkOutTime.toISOString(),
  });
}

/** Mobil checkout: sağlayıcısız rezervasyon oluşturur ve doğrudan onaylar. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const rawKey = req.headers.get("idempotency-key")?.trim();
  if (rawKey !== undefined && rawKey !== "" && !IDEMPOTENCY_KEY.test(rawKey)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }
  const idempotencyKey = rawKey || undefined;
  /*
    TEKRAR: ayni misafirin ayni anahtarla daha once yazilmis rezervasyonu varsa
    AYNI yanit doner. Kupon hakki, hiz siniri ve kapasite ONCEDEN bakilir:
    istemci 12 sn'de istegi iptal edip yeniden gonderdiginde ilk istek coktan
    yazmis olabilir, ikinci kayit misafire cift rezervasyon olurdu.
  */
  if (idempotencyKey) {
    const existing = await bookingService.findBookingByIdempotencyKey(auth.user.id, idempotencyKey);
    if (existing) return bookingResponse(existing);
  }

  // Mobil uc sinirsizdi ve tek hesapla kapasite doldurulabiliyordu. Uc oturumlu: sinir
  // HESAP basina. IP kovasi kaldirildi, otel/havalimani wifi'sindeki ve operator NAT'indaki
  // turistler ayni IP'yi paylasip birbirinin rezervasyonunu engelliyordu.
  if (!(await rateLimit(`booking_create_user:${auth.user.id}`, 5, 5 * 60 * 1000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

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
  /*
    Inceleme kum havuzu (2026-11-23): `reviewSandbox` hesap test dukkanina rezervasyon
    yapabilir (Apple incelemesi gercek esnafa dusmesin). Gercek kullanici icin
    kosul degismedi: `isActive && !isTest && !isPrelaunch`.
  */
  if (!shop || !isShopBookableBy(shop, auth.user)) {
    return NextResponse.json({ error: "shop_not_found" }, { status: 404 });
  }

  /*
    Saat dukkanin saatine oturtulur (2026-11-18). Olusturma saati hic
    denetlemiyordu; mobil arama kapali saatteki dukkanlari gizledigi icin
    sorun gorunmuyordu. Arama artik onlari da listeliyor: alis 22:00 secilip
    20:00'de kapanan dukkana rezervasyon acilmamali.
  */
  const requestedIn = new Date(parsed.data.checkInTime);
  const schedule = (await loadScheduleParts([shop.id], toDatetimeLocalValueInTimeZone(requestedIn).slice(0, 10))).get(shop.id);
  const snapped = snapStayToShopHours(
    { open247: shop.open247, openingTime: shop.openingTime, closingTime: shop.closingTime, timeZone: shop.timezone, ...schedule },
    requestedIn,
    new Date(parsed.data.checkOutTime),
  );
  if (!snapped) {
    return NextResponse.json({ error: "shop_closed_at_time" }, { status: 409 });
  }
  const checkInTime = snapped.checkIn;
  const checkOutTime = snapped.checkOut;
  const rules = await getPricingRules();
  // Zod tavani (20) platform sinirindan buyuk olabilir; kirpilacak istek fiyatlanmaz.
  if (!bagCountsFitRules(parsed.data, rules.maxBagsPerSlot)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }
  const totals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(shop.pricePerDay),
    bagCountS,
    bagCountM,
    bagCountXl,
    checkInTime,
    checkOutTime,
    rules,
  );

  /*
    Indirim secimi `CheckoutDiscountService`te (web ile ayni kural, tek indirim).
    Kupon hakki rezervasyondan ONCE alinir; rezervasyon olusmazsa asagidaki
    `catch` hakki geri verir.
  */
  const discounts = await checkoutDiscountService.claim({
    subtotal: totals.subtotalBeforeCoupon,
    couponCode: parsed.data.couponCode,
    referralCode: parsed.data.referralCode,
    affiliateCode: parsed.data.affiliateCode,
    guest: { userId: auth.user.id },
    // Kanal rotadan: bu uc yalnizca uygulamadan cagrilir, istemci bayragi yok.
    channel: "app",
  });
  const toplam = discounts.totalPrice;
  const appliedCouponId = discounts.couponId;

  /*
    Gosterilen tutar ile hesaplanan tutar ayrisirsa YAZMADAN reddedilir; alinan
    kupon hakki geri verilir. Istemci yeni tutari 409 govdesinden gorur.
  */
  if (
    parsed.data.expectedTotal !== undefined &&
    Math.abs(parsed.data.expectedTotal - toplam) > 0.005
  ) {
    if (appliedCouponId) await couponService.release(appliedCouponId);
    return NextResponse.json({ error: "price_changed", totalPrice: toplam }, { status: 409 });
  }

  let booking;
  try {
    booking = await bookingService.createInitialBooking({
      idempotencyKey,
      guestId: auth.user.id,
      shopId,
      /*
        Mobil istemci dilini yalnizca bu baslikta bildiriyor. Web'de karsiligi
        `getLocale()` -- orada rota zaten `[locale]` tasiyor.
      */
      locale: resolveRequestLocale(req.headers.get("accept-language")),
      totalPrice: toplam,
      couponDiscountAmount: discounts.couponDiscountAmount,
      couponCode: discounts.couponCode,
      referralDiscountAmount: discounts.referralDiscountAmount,
      referredByCode: discounts.referredByCode,
      affiliateCode: discounts.affiliateCode,
      affiliateDiscountAmount: discounts.affiliateDiscountAmount,
      appDiscountAmount: discounts.appDiscountAmount,
      appDiscountPct: discounts.appDiscountPct,
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
    /*
      Rezervasyon olusmadi: alinan kupon hakki GERI VERILMELI, yoksa kampanya
      kotasi gerceklesmemis bir rezervasyon yuzunden yanar. Web tarafi da
      boyle yapiyor.
    */
    if (appliedCouponId) {
      await couponService.release(appliedCouponId);
    }
    // Es zamanli tekrar: kazananin kaydi doner, bu istek hicbir sey yazmadi.
    if (e instanceof BookingIdempotentReplayError) return bookingResponse(e.existing);
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
        // Misafire giden e-postadaki tutar da INDIRIMLI olan.
        toplam,
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
      totalPrice: toplam,
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
    // Istemci bunu `serverTotal` olarak okuyup ekranda gosteriyor.
    totalPrice: toplam,
    checkInTime: checkInTime.toISOString(),
    checkOutTime: checkOutTime.toISOString(),
  });
}
