import { getTranslations, setRequestLocale } from 'next-intl/server';
import { shopService } from '@/services/ShopService';
import SearchClient from '@/components/guest/SearchClient';
import type { Metadata } from 'next';
import {
  SEARCH_DEFAULT_CENTER,
  SEARCH_NEARBY_RADIUS_KM,
  defaultSearchStayWindow,
} from '@/lib/search-defaults';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return {
    title: t("searchTitle", { query: "" }),
    description: t("searchDescription", { query: "" }),
  };
}

/**
 * Guest Search Page - Harita Tabanlı Arama Ekranı (Server Component)
 */
export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { checkIn, checkOut } = defaultSearchStayWindow();

  const [nearbyShops, allShops] = await Promise.all([
    shopService.findShopsForSearch({
      centerLat: SEARCH_DEFAULT_CENTER.lat,
      centerLng: SEARCH_DEFAULT_CENTER.lng,
      radiusKm: SEARCH_NEARBY_RADIUS_KM,
      checkIn,
      checkOut,
      requestedBags: 1,
    }),
    shopService.findShopsForSearch({
      centerLat: SEARCH_DEFAULT_CENTER.lat,
      centerLng: SEARCH_DEFAULT_CENTER.lng,
      radiusKm: null,
      checkIn,
      checkOut,
      requestedBags: 1,
    }),
  ]);

  return (
    <SearchClient
      initialNearby={JSON.parse(JSON.stringify(nearbyShops))}
      initialAll={JSON.parse(JSON.stringify(allShops))}
      defaultCheckInIso={checkIn.toISOString()}
      defaultCheckOutIso={checkOut.toISOString()}
    />
  );
}

