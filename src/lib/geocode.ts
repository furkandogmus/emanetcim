import { fetchWithTimeout } from "@/lib/async-timeout";

export type GeocodedPlace = { lat: number; lng: number; label: string };

/** Sorgu bundan kısaysa ağa çıkılmaz (web debounce'u ile aynı eşik). */
export const GEOCODE_MIN_QUERY_LENGTH = 3;

/*
  NEDEN ÖNBELLEK (2026-10-18): bu gövde önce yalnızca web sunucu eylemindeydi;
  mobil arama sihirbazı da aynı Nominatim'e gitmeye başlayınca istek hacmi
  ikiye katlanıyor. Nominatim kullanım politikası (operations.osmfoundation.org/
  policies/nominatim) en fazla saniyede bir istek ve sonuçların önbelleğe
  alınmasını istiyor; misafirler de büyük ölçüde aynı birkaç şehir/semti
  yazıyor. Süreç içi küçük bir önbellek yeter — tek VM, tek süreç.

  Yalnızca BAŞARILI ya da BOŞ yanıt saklanır; ağ hatası / zaman aşımı
  saklanırsa Nominatim'in geçici bir yavaşlığı bir saat boyunca "sonuç yok"
  olarak kalırdı.
*/
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; value: GeocodedPlace | null }>();

/** Yalnızca testler: modül düzeyindeki önbelleği boşaltır. */
export function resetGeocodeCacheForTests() {
  cache.clear();
}

function cacheGet(key: string): GeocodedPlace | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: GeocodedPlace | null) {
  // Map ekleme sırasını korur: en eski kayıt ilk anahtardır.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

/**
 * Serbest metni (adres, otel, semt) tek bir koordinata çevirir (Nominatim).
 *
 * TEK GÖVDE (2026-10-18): web sunucu eylemi (`geocodeSearchCenterAction`) ve
 * mobil uç (`GET /api/mobile/geocode`) bunu çağırır. Kural iki taşıyıcıda ayrı
 * yazılsaydı zaman aşımı, User-Agent ve kısa-sorgu eşiği zamanla ayrışırdı.
 *
 * Hiçbir koşulda FIRLATMAZ: çözülemeyen, kısa ya da hata alan sorgu `null`.
 */
export async function geocodePlace(
  query: string,
  locale: string = "tr",
): Promise<GeocodedPlace | null> {
  const q = query.trim();
  if (q.length < GEOCODE_MIN_QUERY_LENGTH) return null;

  const key = `${locale}|${q.toLocaleLowerCase("tr")}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", locale);

  try {
    /*
      Gerçek iptal (`fetchWithTimeout`), yarış değil: Nominatim yanıt vermezse
      arama kutusu süresiz "yükleniyor" kalıyordu ve her tuş vuruşu terk
      edilmiş bir soket bırakıyordu (2026-08-25).
    */
    const res = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          // Nominatim requires identifiable UA/contact.
          "User-Agent": "bagajpark-search/1.0 (support@bagajpark.com)",
        },
        next: { revalidate: 0 },
      },
      5000,
      "geocode_search",
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    if (!Array.isArray(data)) return null;
    if (data.length === 0) {
      cacheSet(key, null);
      return null;
    }

    const first = data[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const place = { lat, lng, label: first.display_name ?? q };
    cacheSet(key, place);
    return place;
  } catch {
    return null;
  }
}
