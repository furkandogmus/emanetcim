import { fetchWithTimeout } from "@/lib/async-timeout";

export type GeocodedPlace = {
  lat: number;
  lng: number;
  label: string;
  /** Liste satirinin basligi (otel/cadde adi); kapi numarasi basliga cikmaz. */
  title?: string;
  /** Ilce ve sehir; yoksa display_name'in anlamli parcalari. */
  subtitle?: string;
};

type NominatimHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
};

/**
 * Nominatim sonucundan liste basligi ve alt basligi. `display_name` POI'lerde
 * "Otel, 2, Cadde, Ilce, Sehir, ..." diye gelir: ilk iki parcayi almak kapi
 * numarasini etiket yapiyordu. Once `name`/adres alanlari, yoksa sayisal olmayan
 * parcalar kullanilir.
 */
export function placeTitleSubtitle(d: NominatimHit, fallback: string): { title: string; subtitle: string } {
  const parts = (d.display_name ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^\d+[A-Za-z]?$/.test(p));
  const a = d.address ?? {};
  const title = d.name?.trim() || a.road?.trim() || parts[0] || fallback;
  const district = a.suburb || a.city_district || a.town || a.county || a.neighbourhood;
  const city = a.city || a.province || a.state;
  const fromAddress = [district, city]
    .filter((p, i, all): p is string => !!p && p !== title && all.indexOf(p) === i)
    .join(", ");
  const subtitle = fromAddress || parts.filter((p) => p !== title).slice(0, 2).join(", ");
  return { title, subtitle };
}

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

export type GeocodeListResult = { ok: true; places: GeocodedPlace[] } | { ok: false; reason: "upstream" };

const listCache = new Map<string, { at: number; value: GeocodedPlace[] }>();

/**
 * Mobil yer aramasi: birden cok sonuc ve ulke filtresi (2026-11-18). Tek sonuc
 * ve filtresiz arama "Hilton" ya da "Central Station" yazan turisti baska bir
 * ulkeye atiyordu; Nominatim cokunce de "bulunamadi" deniyordu. Web aramasi
 * `geocodePlace`i kullanmaya devam eder (talep testi noktalari yurt disinda da).
 */
export async function geocodePlaces(
  query: string,
  locale: string = "tr",
  opts: { countryCodes?: string; limit?: number } = {},
): Promise<GeocodeListResult> {
  const q = query.trim();
  if (q.length < GEOCODE_MIN_QUERY_LENGTH) return { ok: true, places: [] };
  const limit = Math.min(10, Math.max(1, opts.limit ?? 5));
  const key = `${locale}|${opts.countryCodes ?? ""}|${limit}|${q.toLocaleLowerCase("tr")}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ok: true, places: hit.value };

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("accept-language", locale);
  if (opts.countryCodes) url.searchParams.set("countrycodes", opts.countryCodes);

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {
        headers: { "User-Agent": "bagajpark-search/1.0 (support@bagajpark.com)" },
        next: { revalidate: 0 },
      },
      5000,
      "geocode_search_list",
    );
    if (!res.ok) return { ok: false, reason: "upstream" };
    const data = (await res.json()) as NominatimHit[];
    if (!Array.isArray(data)) return { ok: false, reason: "upstream" };
    const places = data
      .map((d) => ({
        lat: Number(d.lat),
        lng: Number(d.lon),
        label: d.display_name ?? q,
        ...placeTitleSubtitle(d, q),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (listCache.size >= CACHE_MAX) {
      const oldest = listCache.keys().next().value;
      if (oldest !== undefined) listCache.delete(oldest);
    }
    listCache.set(key, { at: Date.now(), value: places });
    return { ok: true, places };
  } catch {
    return { ok: false, reason: "upstream" };
  }
}
