import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { geocodePlaces, GEOCODE_MIN_QUERY_LENGTH } from "@/lib/geocode";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { resolveRequestLocale } from "@/lib/request-locale";
import { toMobileGeocodeResult } from "@/lib/mobile-dto";

const MAX_QUERY_LENGTH = 200;

/**
 * Arama sihirbazinda serbest metinle yer arama; govde web ile ortak
 * (`geocodePlace`). Oturum istemez: sihirbaz giristen once de acilir.
 *
 * IP basina 20/dk: istemci 450 ms geciktirmeyle soruyor, insan yazma hizina
 * yeter. Fazlasi Nominatim'in saniyede bir istek politikasini bizim adimiza deler.
 */
export async function GET(req: NextRequest) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`mobile_geocode:${ip}`, 20, 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < GEOCODE_MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const locale = resolveRequestLocale(req.headers.get("accept-language"));
  // Rezervasyon alinan butun noktalar Turkiye'de: arama oraya sinirli, bes sonuc.
  const result = await geocodePlaces(q, locale, { countryCodes: "tr", limit: 5 });
  if (!result.ok) return NextResponse.json({ error: "geocode_unavailable" }, { status: 503 });
  if (result.places.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Ust duzey alanlar eski uygulama icin (tek sonuc); yeni uygulama `items`i okur.
  return NextResponse.json({
    ...toMobileGeocodeResult(result.places[0]),
    items: result.places.map(toMobileGeocodeResult),
  });
}
