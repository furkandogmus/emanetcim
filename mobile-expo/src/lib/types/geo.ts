/** `toMobileGeocodeResult` (mobile-dto/geo.ts) — `GET /geocode?q=`. */
export type GeocodeResult = {
  label: string;
  /** Satir basligi (otel/cadde adi) ve alt basligi (ilce, sehir). Eski sunucuda yok. */
  title?: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  /** En fazla bes sonuc (Turkiye). Eski sunucu gondermez: o zaman ust duzey tek sonuc. */
  items?: { label: string; title?: string; subtitle?: string; latitude: number; longitude: number }[];
};

/** `/cities`: dukkani olan sehirler (sunucu `toMobileCity`). */
export type CityCoverage = {
  name: string;
  /** Yazimdan bagimsiz anahtar ("istanbul"); eski sunucuda yok, istemci adindan turetir. */
  slug?: string;
  shopCount: number;
  latitude: number;
  longitude: number;
  /** Merkezden sehrin en uzak dukkanina (m). Eski sunucu gondermez. */
  radiusM?: number;
  coverImage: string | null;
};

/** `/cities/[slug]/districts`: dukkani olan ilceler (sunucu `toMobileDistrict`). */
export type DistrictCoverage = {
  name: string;
  slug: string;
  shopCount: number;
  /** Ilcedeki dukkanlarin ortalamasi. */
  latitude: number;
  longitude: number;
  /** Merkezden ilcenin en uzak dukkanina (m), en az 15 km. */
  radiusM: number;
};
