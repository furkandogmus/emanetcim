import { setRequestLocale, getTranslations } from 'next-intl/server';
import { shopService } from '@/services/ShopService';
import CheckoutClient from '@/components/guest/CheckoutClient';
import { moneyToNumber } from '@/lib/money';
import { getPricingRules } from '@/lib/platform-settings';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { analyticsService } from '@/services/AnalyticsService';
import { resolveServerSessionId } from '@/lib/analytics-server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}): Promise<Metadata> {
  const { locale, shopId } = await params;
  /*
    FILTRELI OKUMA (2026-08-31). `getShopDetails` filtresizdi: test dukkanlari
    da checkout sayfasi uretiyordu. `OPERATING_SHOP_FILTER` hem testi hem
    isletilmeyen talep testi noktalarini disari aliyor -- ikisi de rezervasyon
    ALMAZ, o yuzden checkout sayfalari da olmamali.
  */
  const shop = await shopService.getOperatingShopById(shopId);
  if (!shop) {
    return { title: "Checkout" };
  }
  const t = await getTranslations({ locale, namespace: "Guest" });
  return {
    title: t("checkoutPageTitle", { shopName: shop.name }),
    robots: { index: false, follow: true },
  };
}

/**
 * Checkout Page - Rezervasyon Sayfası (Server Component)
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string, shopId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, shopId } = await params;
  const sp = searchParams ? await searchParams : {};
  setRequestLocale(locale);

  // Veritabanından dükkan bilgilerini, oturumu ve ayarları paralel çek
  const [shop, session, pricingRules] = await Promise.all([
    shopService.getOperatingShopById(shopId),
    auth(),
    getPricingRules(),
  ]);

  if (!shop) {
    notFound();
  }

  analyticsService.track({
    name: "checkout_started",
    sessionId: await resolveServerSessionId(session?.user?.id),
    userId: session?.user?.id ?? null,
    locale,
    metadata: { shopId },
  });

  const isLoggedIn = !!session?.user?.id;
  const checkInParam = typeof sp.checkIn === "string" ? sp.checkIn : undefined;
  const checkOutParam = typeof sp.checkOut === "string" ? sp.checkOut : undefined;
  const bagsParam = typeof sp.bags === "string" ? parseInt(sp.bags, 10) : undefined;

  return (
    <CheckoutClient 
      shopId={shopId} 
      shopName={shop.name} 
      shopAddress={shop.address || "Istanbul"} 
      pricePerDay={moneyToNumber(shop.pricePerDay) || pricingRules.defaultPricePerDay}
      pricingRules={pricingRules}
      isLoggedIn={isLoggedIn}
      initialCheckIn={checkInParam}
      initialCheckOut={checkOutParam}
      initialBags={!isNaN(bagsParam ?? -1) ? bagsParam : undefined}
      /* Slot müsaitliği dükkanın kendi diliminde üretiliyor; checkout da aynı
         dilimi kullanmalı, yoksa İstanbul dışı bir dükkanda saatler kayar. */
      timeZone={shop.timezone ?? undefined}
    />
  );
}
