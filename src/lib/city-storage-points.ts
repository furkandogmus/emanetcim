import logger from "@/lib/logger";
import { getActiveShopsOrderedByDistanceKm } from "@/lib/shop-distance-postgis";
import type { STORAGE_CITIES } from "@/lib/storage-cities";

export type CityStoragePoint = {
  id: string;
  name: string;
  district: string | null;
  /** Talep testi noktası: görünür ama rezervasyon almaz. */
  isPrelaunch: boolean;
};

const MAX_POINTS = 24;

/**
 * Şehir sayfasındaki nokta listesi.
 *
 * NEDEN VAR (2026-09-13): şehir sayfası "Bodrum'daki güncel noktaları bu
 * sayfadaki listeden görebilirsiniz" diyordu ama sayfada liste yoktu; metin
 * ile ekran çelişiyordu. Liste aynı zamanda sayfanın tek GERÇEK yerel içeriği:
 * nokta adları ve semtleri ("Kadıköy", "Merkez Garaj") aramanın sorduğu
 * kelimeler ve her biri nokta sayfasına bir iç bağlantı.
 *
 * PUBLIC filtre (talep testi dahil), OPERATING değil: bu liste misafire
 * "burada şu noktalar var" diyor, aramada ve haritada gördüğüyle aynı şeyi.
 * Talep testi noktası "Yakında" rozetiyle ayrılıyor; rezervasyona açık
 * noktalar önce geliyor.
 *
 * Hata FIRLATMAZ: build sırasında veritabanı yok (yer tutucu `DATABASE_URL`)
 * ve sayfa yine üretilmeli. Boş liste bölümü gizler, ISR sonra doldurur.
 */
export async function getCityStoragePoints(
  city: Pick<(typeof STORAGE_CITIES)[number], "slug" | "lat" | "lng" | "pointsRadiusKm">,
): Promise<CityStoragePoint[]> {
  try {
    const rows = await getActiveShopsOrderedByDistanceKm({
      centerLat: city.lat,
      centerLng: city.lng,
      radiusKm: city.pointsRadiusKm,
    });
    return sortCityStoragePoints(
      rows.map(({ shop }) => ({
        id: shop.id,
        name: shop.name,
        district: shop.district,
        isPrelaunch: shop.isPrelaunch,
      })),
    ).slice(0, MAX_POINTS);
  } catch (err) {
    logger.warn({ err, city: city.slug }, "city_storage_points_unavailable");
    return [];
  }
}

/** Rezervasyona açık noktalar önce; her grup içinde mesafe sırası korunur. */
export function sortCityStoragePoints(points: CityStoragePoint[]): CityStoragePoint[] {
  return [
    ...points.filter((p) => !p.isPrelaunch),
    ...points.filter((p) => p.isPrelaunch),
  ];
}
