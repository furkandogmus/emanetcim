import { setRequestLocale } from 'next-intl/server';
import { shopService } from '@/services/ShopService';
import CheckoutClient from '@/components/guest/CheckoutClient';
import { moneyToNumber } from '@/lib/money';
import { notFound } from 'next/navigation';

/**
 * Checkout Page - Rezervasyon ve Ödeme Sayfası (Server Component)
 */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: string, shopId: string }> }) {
  const { locale, shopId } = await params;
  setRequestLocale(locale);

  // Veritabanından dükkan bilgilerini çek
  const shop = await shopService.getShopDetails(shopId);

  if (!shop) {
    notFound();
  }

  return (
    <CheckoutClient 
      shopId={shopId} 
      shopName={shop.name} 
      shopAddress={shop.address || "Istanbul"} 
      pricePerDay={moneyToNumber(shop.pricePerDay) || 50}
    />
  );
}
