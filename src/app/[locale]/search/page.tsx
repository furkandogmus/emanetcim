import { getTranslations, setRequestLocale } from 'next-intl/server';
import { shopService } from '@/services/ShopService';
import SearchClient from '@/components/guest/SearchClient';
import type { Metadata } from 'next';
import {
  SEARCH_DEFAULT_CENTER,
  SEARCH_NEARBY_RADIUS_KM,
  defaultSearchStayWindow,
} from '@/lib/search-defaults';
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";

/**
 * `explicit`: merkez URL'den mi geldi, yoksa varsayilana mi dusuldu.
 *
 * Bu ayrim, tarayici konumunun merkezi ne zaman EZEBILECEGINI belirler:
 * kullanici bir sehir baglantisiyla ya da paylasilmis bir aramayla geldiyse
 * o merkez bilincli bir tercihtir. Koordinatlari varsayilanla karsilastirmak
 * yeterli degil -- birisi tam da Istanbul merkezini elle gecirebilir.
 */
function parseCenter(
  latRaw: string | undefined,
  lngRaw: string | undefined,
): { lat: number; lng: number; explicit: boolean } {
  const fallback = {
    lat: SEARCH_DEFAULT_CENTER.lat,
    lng: SEARCH_DEFAULT_CENTER.lng,
    explicit: false,
  };
  const lat = latRaw != null ? Number(latRaw) : NaN;
  const lng = lngRaw != null ? Number(lngRaw) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return fallback;
  return { lat, lng, explicit: true };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const t = await getTranslations({ locale, namespace: "Guest" });
  const base = getSiteBaseUrl();
  const title = q
    ? t("searchTitle", { query: q })
    : t("searchTitleBrowse");
  const description = q
    ? t("searchDescription", { query: q })
    : t("searchDescriptionBrowse");
  const searchCanonical = `${base}/${locale}/search`;
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/search"),
    openGraph: {
      title,
      description,
      url: searchCanonical,
    },
  };
}

/**
 * Guest Search Page - Harita Tabanlı Arama Ekranı (Server Component)
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; lat?: string; lng?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const center = parseCenter(sp.lat, sp.lng);
  const initialQuery = (sp.q ?? "").trim();

  const { checkIn, checkOut } = defaultSearchStayWindow();

  const allShops = await shopService.findShopsForSearch({
    centerLat: center.lat,
    centerLng: center.lng,
    radiusKm: null,
    checkIn,
    checkOut,
    requestedBags: 1,
  });

  const nearbyShops = allShops.filter(s => s.distanceKm <= SEARCH_NEARBY_RADIUS_KM);

  return (
    <SearchClient
      initialNearby={JSON.parse(JSON.stringify(nearbyShops))}
      initialAll={JSON.parse(JSON.stringify(allShops))}
      defaultCheckInIso={checkIn.toISOString()}
      defaultCheckOutIso={checkOut.toISOString()}
      initialSearchQuery={initialQuery}
      searchCenter={{ lat: center.lat, lng: center.lng }}
      hasExplicitCenter={center.explicit}
    />
  );
}

