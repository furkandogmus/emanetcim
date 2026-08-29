import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { shopService } from "@/services/ShopService";
import {
  bookingService,
} from "@/services/BookingService";
import PartnerClient from "@/components/partner/PartnerClient";
import { redirect } from "next/navigation";
import { getMerchantShareRatio, countsTowardEarnings } from "@/lib/platform-split";
import { moneyToNumber } from "@/lib/money";
import { getPricingRules } from "@/lib/platform-settings";
import prisma from "@/lib/db";
import { analyticsService } from "@/services/AnalyticsService";

/**
 * esnaf Ana Sayfası - Partner Dashboard (Server Component)
 * Query: ?booking=<uuid> check-in akışı, ?checkoutBooking=<uuid> teslim onayı
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

  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user?.id || (role !== "PARTNER" && role !== "ADMIN")) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/partner`);
  }

  const shops = await shopService.getShopsByOwner(session.user.id);
  /**
   * Panel eskiden koşulsuz `shops[0]`'ı gösteriyordu. Çok dükkanlı esnafın
   * (seed'deki demo esnaf: Galata + Sultanahmet) ikinci dükkanındaki valizler
   * "İşlem Geçmişi"nde hiç görünmüyordu: check-in `?booking=`/QR ile sahiplik
   * üzerinden çalıştığı için valiz ALINIYOR ama listede bulunamıyor, dolayısıyla
   * teslim edilemiyordu. Seçim `?shop=` ile, sahiplik listesinden doğrulanarak.
   */
  const requestedShopId = sp.shop?.trim();
  const activeShop =
    shops.find((s) => s.id === requestedShopId) ?? shops[0];

  if (!activeShop) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-10 text-center">
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          {t("noShopTitle")}
        </h1>
        <p className="text-gray-500 mb-8 max-w-xs">
          {t("noShopDesc")}
        </p>
      </div>
    );
  }

  const [result, pricingRules, ownerPhoneRow, monthlyShopViews] = await Promise.all([
    bookingService.getPartnerBookings(activeShop.id),
    getPricingRules(),
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { phone: true },
    }),
    analyticsService.getShopViewCountThisMonth(activeShop.id),
  ]);
  const bookings = result.items;
  const activeCount = bookings.filter(
    (b) => b.status === "PAID" || b.status === "CHECKED_IN"
  ).length;
  // Kazanç sayfasıyla AYNI tanım (bkz. EARNING_BOOKING_STATUSES). Daha önce burada
  // "CANCELLED olmayan her şey" sayılıyordu ve ödenmemiş rezervasyonlar da hakedişe
  // giriyordu; iki ekran farklı net hakediş gösteriyordu.
  const totalEarnings = bookings.reduce(
    (sum, b) =>
      sum + (countsTowardEarnings(b.status) ? moneyToNumber(b.totalPrice) : 0),
    0
  );

  const merchantShareRatio = getMerchantShareRatio(pricingRules.platformCommissionRate);
  const marketPrice = pricingRules.defaultPricePerDay;

  return (
    <PartnerClient
      shopId={activeShop.id}
      shopName={activeShop.name}
      activeCount={activeCount}
      totalEarnings={totalEarnings}
      merchantShareRatio={merchantShareRatio}
      initialCapacity={activeShop.capacity}
      initialOpening={activeShop.openingTime || "09:00"}
      initialClosing={activeShop.closingTime || "20:00"}
      initialPricePerDay={moneyToNumber(activeShop.pricePerDay) || marketPrice}
      marketPrice={marketPrice}
      bookings={JSON.parse(JSON.stringify(bookings))}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      initialBookingId={initialBookingId}
      initialCheckoutBookingId={initialCheckoutBookingId}
      initialPhone={ownerPhoneRow?.phone ?? ""}
      requireSeals={pricingRules.requireSealsOnCheckIn}
      monthlyShopViews={monthlyShopViews}
    />
  );
}
