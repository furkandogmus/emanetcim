"use server";

import { fetchWithTimeout } from "@/lib/async-timeout";

type GeocodeSearchCenterResult =
  | { ok: true; lat: number; lng: number; label: string }
  | { ok: false };

/**
 * Forward geocode text query into map center coordinates.
 * Uses Nominatim with a Turkey-biased query for local relevance.
 */
export async function geocodeSearchCenterAction(
  query: string,
  locale: string = "tr",
): Promise<GeocodeSearchCenterResult> {
  const q = query.trim();
  if (q.length < 3) return { ok: false };

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", locale);

  try {
    /**
     * NEDEN zaman aşımı (2026-08-25): bu, misafirin arama kutusuna yazarken
     * canlı tetiklenen bir sunucu eylemi (bkz. `SearchClient.tsx` debounce).
     * Ücretsiz/hız-sınırlı bir üçüncü taraf servise (Nominatim) sınırsız
     * bekleyen bir `fetch` — yanıt vermezse arama kutusu süresiz "yükleniyor"
     * kalır. Client tarafında zaten "bilinen şehir merkezine düş" yedeği var
     * (`SearchClient.tsx`, ~satır 223) ama o yalnızca bu istek BİR SONUÇLA
     * (başarı ya da hata) döndüğünde devreye giriyor — sonsuz askıda kalan bir
     * istek o yedeğe hiç ulaşamaz. Zaman aşımı, `catch` bloğunun zaten
     * döndürdüğü `{ ok: false }` ile aynı yola düşürüp var olan yedeği
     * tamamlıyor.
     *
     * `fetchWithTimeout` (yarış değil, gerçek iptal): Nominatim ücretsiz ve
     * yavaşlamaya açık. Yalnızca vazgeçmek yetmez — istek de sonlandırılmalı,
     * yoksa her tuş vuruşunda terk edilmiş bir soket birikir.
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
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    if (!Array.isArray(data) || data.length === 0) return { ok: false };

    const first = data[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false };

    return {
      ok: true,
      lat,
      lng,
      label: first.display_name ?? q,
    };
  } catch {
    return { ok: false };
  }
}
