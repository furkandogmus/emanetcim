import { getTranslations, setRequestLocale } from 'next-intl/server';
import { shopService } from '@/services/ShopService';
import SearchClient from '@/components/guest/SearchClient';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return {
    title: t("searchTitle") || "Emanet Noktası Ara",
    description: t("searchDescription") || "Sana en yakın BagajPark emanet noktalarını bul ve valizini güvenle bırak.",
  };
}

const ISTANBUL_CENTER = { lat: 41.0256, lng: 28.9741 };
const NEARBY_RADIUS_KM = 10;

/**
 * Guest Search Page - Harita Tabanlı Arama Ekranı (Server Component)
 */
export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [nearbyShops, allShops] = await Promise.all([
    shopService.findNearby(ISTANBUL_CENTER.lat, ISTANBUL_CENTER.lng, NEARBY_RADIUS_KM),
    shopService.getAllActive(ISTANBUL_CENTER.lat, ISTANBUL_CENTER.lng),
  ]);

  return <SearchClient initialShops={nearbyShops} allShops={allShops} />;
}

