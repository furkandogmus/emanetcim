type GeocodedPlaceSource = { lat: number; lng: number; label: string; title?: string; subtitle?: string };

/**
 * Adres arama sonucu. Alan adlari istemcinin `Place` tipiyle ayni
 * (`latitude`/`longitude`), sonuc dogrudan secilebilsin diye.
 * `/api/mobile/geocode`in tek yaziciysi.
 */
export function toMobileGeocodeResult(p: GeocodedPlaceSource) {
  // title/subtitle: liste satiri; eski sunucudan gelen/istemci cache'i yoksa label'a duser.
  return { label: p.label, title: p.title ?? p.label, subtitle: p.subtitle ?? "", latitude: p.lat, longitude: p.lng };
}

/** Ana sayfa "Populer sehirler" karti. */
export function toMobileCity(c: import("@/services/CityCoverageService").CityCoverage) {
  return {
    name: c.name,
    slug: c.slug,
    shopCount: c.shopCount,
    latitude: c.latitude,
    longitude: c.longitude,
    radiusM: c.radiusM,
    coverImage: c.coverImage,
  };
}

// --- Arama: sehrin ilceleri (GET /cities/[city]/districts) ---

/** Sehirden sonraki ilce adimi; merkez ilcedeki dukkanlarin ortalamasi. */
export function toMobileDistrict(d: import("@/services/CityCoverageService").DistrictCoverage) {
  return {
    name: d.name,
    slug: d.slug,
    shopCount: d.shopCount,
    latitude: d.latitude,
    longitude: d.longitude,
    radiusM: d.radiusM,
  };
}
