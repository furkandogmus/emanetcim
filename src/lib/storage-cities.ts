/**
 * SEO şehir sayfaları: URL slug + harita merkezi (yakın arama / mesafe).
 * Metinler i18n `CityStorage.{slug}.*` altında.
 *
 * `pointsRadiusKm`: şehir sayfasındaki nokta listesinin yarıçapı. Merkezden
 * ölçülüyor, yani ilçeye yayılan yerlerde şehir çapından geniş tutuldu: Bodrum
 * Yalıkavak ~18 km, İstanbul Havalimanı merkeze 36 km (Sabiha Gökçen 31 km).
 */
export const STORAGE_CITIES = [
  {
    slug: "istanbul",
    country: "TR",
    pointsRadiusKm: 40,
    lat: 41.0082,
    lng: 28.9784,
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "ankara",
    country: "TR",
    pointsRadiusKm: 20,
    lat: 39.9334,
    lng: 32.8597,
    image: "/images/cities/ankara.jpg"
  },
  {
    slug: "izmir",
    country: "TR",
    pointsRadiusKm: 20,
    lat: 38.4237,
    lng: 27.1428,
    image: "/images/cities/izmir.jpg"
  },
  {
    slug: "antalya",
    country: "TR",
    pointsRadiusKm: 25,
    lat: 36.8969,
    lng: 30.7133,
    image: "/images/cities/antalya.jpg"
  },
  {
    slug: "bodrum",
    country: "TR",
    pointsRadiusKm: 25,
    lat: 37.0344,
    lng: 27.4305,
    image: "/images/cities/bodrum.jpg"
  },
  {
    // 2026-09-23: ilk isleyen Mugla dukkani Fethiye'de. 30 km: Olu Deniz
    // (~13 km) ve Gocek (~25 km) dahil; Dalaman Havalimani (~45 km) degil.
    slug: "fethiye",
    country: "TR",
    pointsRadiusKm: 30,
    lat: 36.6214,
    lng: 29.1164,
    // Unsplash kzEMrCC0ink (Olu Deniz, Dilek Durgun) — Unsplash lisansi, atif sart degil.
    image: "/images/cities/fethiye.jpg"
  },
  {
    slug: "cappadocia",
    country: "TR",
    pointsRadiusKm: 25,
    lat: 38.6244,
    lng: 34.7122,
    image: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "berlin",
    country: "DE",
    pointsRadiusKm: 15,
    lat: 52.52,
    lng: 13.405,
    image: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "paris",
    country: "FR",
    pointsRadiusKm: 15,
    lat: 48.8566,
    lng: 2.3522,
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "barcelona",
    country: "ES",
    pointsRadiusKm: 15,
    lat: 41.3874,
    lng: 2.1686,
    image: "https://images.unsplash.com/photo-1583422409516-2895a77efedd?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "rome",
    country: "IT",
    pointsRadiusKm: 15,
    lat: 41.9028,
    lng: 12.4964,
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80"
  },
  {
    slug: "amsterdam",
    country: "NL",
    pointsRadiusKm: 15,
    lat: 52.3676,
    lng: 4.9041,
    image: "/images/cities/amsterdam.jpg"
  },
  {
    slug: "london",
    country: "GB",
    pointsRadiusKm: 15,
    lat: 51.5074,
    lng: -0.1278,
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80"
  },
] as const;

export type StorageCitySlug = (typeof STORAGE_CITIES)[number]["slug"];

/**
 * Şehir sayfası ARAMA MOTORUNA açık mı?
 *
 * NEDEN ÜLKEYE BAĞLI (2026-09-13, Search Console 6 Haz–10 Eyl): yurtdışı altı
 * şehir sayfası 5.143 gösterimde 5 tıklama aldı (%0,1, ortalama sıra 25–45);
 * Türkiye'deki altı şehir 4.271 gösterimde 354 tıklama (%8,3). Yurtdışında
 * yalnızca talep testi noktası var ve Google o sayfaları rakip pazar
 * yerlerinin çok gerisinde tutuyor. Dizinde kalmaları trafik getirmiyor ama
 * sitenin geri kalanına "ince içerik" sinyali taşıyor.
 *
 * NEDEN DÜKKAN SAYISINA BAĞLI DEĞİL: aynı gün işleyen dükkan yalnızca iki
 * (Ankara Çankaya, İstanbul Kadıköy). En çok tıklanan sayfa Bodrum (199) ve
 * orada yalnızca talep testi noktası var — "işleyen dükkan yoksa noindex"
 * kuralı en iyi sayfayı dizinden atardı. Talep testinin ölçtüğü şey tam da o
 * trafik.
 *
 * Sayfa `noindex, follow` olur (bağlantıları izlenir) ve site haritasına
 * girmez. Talep gelirse bir şehri geri açmak bu fonksiyonu değiştirmektir.
 */
export function isStorageCityIndexed(city: { country: string }): boolean {
  return city.country === "TR";
}

export const INDEXED_STORAGE_CITIES = STORAGE_CITIES.filter(isStorageCityIndexed);

export function getStorageCity(slug: string) {
  return STORAGE_CITIES.find((c) => c.slug === slug);
}
