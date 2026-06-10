/**
 * SEO şehir sayfaları: URL slug + harita merkezi (yakın arama / mesafe).
 * Metinler i18n `CityStorage.{slug}.*` altında.
 */
export const STORAGE_CITIES = [
  {
    slug: "istanbul",
    lat: 41.0082,
    lng: 28.9784,
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "ankara",
    lat: 39.9334,
    lng: 32.8597,
    image: "https://images.unsplash.com/photo-1589882485526-7bc2b9a7061d?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "izmir",
    lat: 38.4237,
    lng: 27.1428,
    image: "https://images.unsplash.com/photo-1601931818273-04ff53289069?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "antalya",
    lat: 36.8969,
    lng: 30.7133,
    image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "bodrum",
    lat: 37.0344,
    lng: 27.4305,
    image: "https://images.unsplash.com/photo-1599839446416-ca33eb1fbc40?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "cappadocia",
    lat: 38.6244,
    lng: 34.7122,
    image: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "berlin",
    lat: 52.52,
    lng: 13.405,
    image: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "paris",
    lat: 48.8566,
    lng: 2.3522,
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "barcelona",
    lat: 41.3874,
    lng: 2.1686,
    image: "https://images.unsplash.com/photo-1583422409516-2895a77efedd?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "rome",
    lat: 41.9028,
    lng: 12.4964,
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "amsterdam",
    lat: 52.3676,
    lng: 4.9041,
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "london",
    lat: 51.5074,
    lng: -0.1278,
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80"
  },
] as const;

export type StorageCitySlug = (typeof STORAGE_CITIES)[number]["slug"];

export function getStorageCity(slug: string) {
  return STORAGE_CITIES.find((c) => c.slug === slug);
}
