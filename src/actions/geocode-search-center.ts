"use server";

import { geocodePlace } from "@/lib/geocode";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";

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
  // Girissiz Nominatim vekili: sinirsiz kalirsa sunucu IP'si Nominatim'den yasaklanir.
  const ip = await getClientIp();
  if (!(await rateLimit(`geocode_center:${ip}`, 30, 60_000))) return { ok: false };
  const place = await geocodePlace(query, locale);
  return place ? { ok: true, ...place } : { ok: false };
}
