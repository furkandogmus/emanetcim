/**
 * SEO şehir sayfaları: URL slug + harita merkezi (yakın arama / mesafe).
 * Metinler i18n `CityStorage.{slug}.*` altında.
 */
export const STORAGE_CITIES = [
  { slug: "istanbul", lat: 41.0082, lng: 28.9784 },
  { slug: "ankara", lat: 39.9334, lng: 32.8597 },
  { slug: "izmir", lat: 38.4237, lng: 27.1428 },
  { slug: "antalya", lat: 36.8969, lng: 30.7133 },
  { slug: "bodrum", lat: 37.0344, lng: 27.4305 },
  { slug: "cappadocia", lat: 38.6244, lng: 34.7122 },
] as const;

export type StorageCitySlug = (typeof STORAGE_CITIES)[number]["slug"];

export function getStorageCity(slug: string) {
  return STORAGE_CITIES.find((c) => c.slug === slug);
}
