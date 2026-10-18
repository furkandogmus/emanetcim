"use server";

import { geocodePlace } from "@/lib/geocode";

type GeocodeSearchCenterResult =
  | { ok: true; lat: number; lng: number; label: string }
  | { ok: false };

/**
 * Forward geocode text query into map center coordinates.
 * Gövde `src/lib/geocode.ts`te; mobil uç (`/api/mobile/geocode`) da onu çağırır.
 */
export async function geocodeSearchCenterAction(
  query: string,
  locale: string = "tr",
): Promise<GeocodeSearchCenterResult> {
  const place = await geocodePlace(query, locale);
  return place ? { ok: true, ...place } : { ok: false };
}
