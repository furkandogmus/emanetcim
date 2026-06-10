import { setRequestLocale, getTranslations } from 'next-intl/server';
import { shopService } from '@/services/ShopService';
import CheckoutClient from '@/components/guest/CheckoutClient';
import { moneyToNumber } from '@/lib/money';
import { getPricingRules } from '@/lib/platform-settings';
import { isPaymentsEnabled } from '@/lib/feature-flags';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}): Promise<Metadata> {
  const { locale, shopId } = await params;
  const shop = await shopService.getShopDetails(shopId);
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
 * Checkout Page - Rezervasyon ve Ödeme Sayfası (Server Component)
 */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: string, shopId: string }> }) {
  const { locale, shopId } = await params;
  setRequestLocale(locale);

  // Veritabanından dükkan bilgilerini, oturumu ve ayarları paralel çek
  const [shop, session, pricingRules, paymentsEnabled] = await Promise.all([
    shopService.getShopDetails(shopId),
    auth(),
    getPricingRules(),
    isPaymentsEnabled(),
  ]);

  if (!shop) {
    notFound();
  }

  const isLoggedIn = !!session?.user?.id;

  return (
    <CheckoutClient 
      shopId={shopId} 
      shopName={shop.name} 
      shopAddress={shop.address || "Istanbul"} 
      pricePerDay={moneyToNumber(shop.pricePerDay) || pricingRules.defaultPricePerDay}
      pricingRules={pricingRules}
      paymentsEnabled={paymentsEnabled}
      isLoggedIn={isLoggedIn}
    />
  );
}
