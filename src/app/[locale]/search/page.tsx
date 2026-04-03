import { setRequestLocale } from 'next-intl/server';
import { shopService } from '@/services/ShopService';
import SearchClient from '@/components/guest/SearchClient';

/**
 * Guest Search Page - Harita Tabanlı Arama Ekranı (Server Component)
 */
export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Veritabanından gerçek dükkanları çek
  const shops = await shopService.findNearby(41.0256, 28.9741, 10);

  return <SearchClient initialShops={shops} />;
}

