"use server";

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
    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim requires identifiable UA/contact.
        "User-Agent": "bagajpark-search/1.0 (support@bagajpark.com)",
      },
      next: { revalidate: 0 },
    });
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
