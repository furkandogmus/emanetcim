import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { bookingService } from "@/services/BookingService";
import { analyticsService } from "@/services/AnalyticsService";
import { partnerEarningsService } from "@/services/PartnerEarningsService";
import { partnerDashboardService } from "@/services/PartnerDashboardService";
import { getEffectiveCommission } from "@/lib/commission";
import { getPricingRules } from "@/lib/platform-settings";
import { isStorageConfigured } from "@/lib/storage";
import { moneyToNumber } from "@/lib/money";
import { requirePartnerPage } from "@/lib/page-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import PartnerClient from "@/components/partner/PartnerClient";

/**
 * Esnaf Ana Sayfası — Partner Dashboard (Server Component)
 * Query: ?booking=<uuid> check-in akışı, ?checkoutBooking=<uuid> teslim onayı,
 *        ?shop=<uuid> aktif dükkan
 */
export default async function PartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    booking?: string;
    checkoutBooking?: string;
    shop?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Partner");

  const sp = (await searchParams) ?? {};
  const initialBookingId = sp.booking?.trim() || undefined;
  const initialCheckoutBookingId = sp.checkoutBooking?.trim() || undefined;

  const actor = await requirePartnerPage(locale, "/partner");

  /**
   * Panel eskiden koşulsuz `shops[0]`'ı gösteriyordu. Çok dükkanlı esnafın
   * ikinci dükkanındaki valizler "İşlem Geçmişi"nde hiç görünmüyordu: check-in
   * `?booking=`/QR ile sahiplik üzerinden çalıştığı için valiz ALINIYOR ama
   * listede bulunamıyor, dolayısıyla teslim edilemiyordu. Seçim artık
   * `partner-shop.ts`'te — alt sayfalarla AYNI kural.
   */
  const { shops, activeShop } = await resolvePartnerShops(actor.id, sp.shop);

  if (!activeShop) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-10 text-center">
        <h1 className="text-2xl font-black text-gray-900 mb-4">{t("noShopTitle")}</h1>
        <p className="text-gray-500 mb-8 max-w-xs">{t("noShopDesc")}</p>
      </div>
    );
  }

  const [shopDetail, commission] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: activeShop.id },
      select: {
        capacity: true,
        openingTime: true,
        closingTime: true,
        pricePerDay: true,
        timezone: true,
      },
    }),
    getEffectiveCommission(),
  ]);
  if (!shopDetail) redirect(`/${locale}/partner`);

  const [result, pricingRules, ownerPhoneRow, monthlyShopViews, totals] =
    await Promise.all([
      bookingService.getPartnerBookings(activeShop.id),
      getPricingRules(),
      prisma.user.findUnique({
        where: { id: actor.id },
        select: { phone: true },
      }),
      analyticsService.getShopViewCountThisMonth(activeShop.id),
      /*
        TOPLAM KAZANC ARTIK LISTEDEN DEGIL, TOPLAMADAN.

        Onceki hal `bookings.reduce(...)` ile hesapliyordu; ama `bookings`
        `getPartnerBookings()`in ILK SAYFASI ve varsayilan limiti 100. Yani
        100'den fazla rezervasyonu olan esnafin ana paneldeki "toplam kazanc"i
        sessizce eksikti ve kazanc sayfasindaki rakamla tutmuyordu.
      */
      partnerEarningsService.getTotals(activeShop.id, commission.rate),
    ]);

  /*
    GUNLUK ENSTANTANE. Panel yalnizca omur boyu toplamlari gosteriyordu; esnafin
    dukkani actiginda sordugu sorularin (bugun kac valiz gelecek, kaci alinacak,
    elimde ne var, bu ay nasil gidiyor) hicbiri ekranda yoktu.
  */
  const pulse = await partnerDashboardService.getSnapshot(
    activeShop.id,
    shopDetail.timezone,
    commission.rate,
  );

  /*
    `activeCount` KALDIRILDI (2026-09-01). Panelde "AKTIF EMANETLER" karti
    olarak duruyordu ve gunluk durum blogu eklenince onun kopyasi haline geldi
    -- "Elinde duran" (valiz) ile yan yana iki farkli sayi gosteriyordu.

    Ayrica ayni kesilme hatasini tasiyordu: `result.items` `getPartnerBookings()`
    in ILK SAYFASI (varsayilan limit 100), yani 100'den fazla rezervasyonu olan
    esnafta sayi sessizce eksikti.
  */
  const bookings = result.items;

  const marketPrice = pricingRules.defaultPricePerDay;

  return (
    <PartnerClient
      shopId={activeShop.id}
      shopName={activeShop.name}
      totalEarnings={totals.gross}
      merchantShareRatio={commission.merchantShareRatio}
      initialCapacity={shopDetail.capacity}
      initialOpening={shopDetail.openingTime || "09:00"}
      initialClosing={shopDetail.closingTime || "20:00"}
      initialPricePerDay={moneyToNumber(shopDetail.pricePerDay) || marketPrice}
      marketPrice={marketPrice}
      bookings={JSON.parse(JSON.stringify(bookings))}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      initialBookingId={initialBookingId}
      initialCheckoutBookingId={initialCheckoutBookingId}
      initialPhone={ownerPhoneRow?.phone ?? ""}
      requireSeals={pricingRules.requireSealsOnCheckIn}
      /* Depolama hazir degilse check-in fotograf alani hic cizilmez. */
      storageReady={isStorageConfigured()}
      monthlyShopViews={monthlyShopViews}
      pulse={pulse}
      capacity={shopDetail.capacity}
      commissionActive={commission.rate > 0}
    />
  );
}
