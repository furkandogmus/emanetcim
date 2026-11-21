import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { geocodePlaces, GEOCODE_MIN_QUERY_LENGTH } from "@/lib/geocode";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { resolveRequestLocale } from "@/lib/request-locale";
import { toMobileGeocodeResult } from "@/lib/mobile-dto";
import { geocodeCacheKey, getCachedPlaces, setCachedPlaces } from "@/lib/geocode-cache";

const MAX_QUERY_LENGTH = 200;

/**
 * Arama sihirbazinda serbest metinle yer arama; govde web ile ortak
 * (`geocodePlaces`). Oturum istemez: sihirbaz giristen once de acilir.
 *
 * Onbellek isabeti Nominatim'e gitmez: IP basina 120/dk. Kacirma IP basina 20/dk
 * (istemci 450 ms geciktirmeyle soruyor) ve tum sunucuda 60/dk: Nominatim'in
 * saniyede bir istek politikasi tum turistlerin toplamina uygulanir. Ayni IP'yi
 * paylasan otel/havalimani agi eskiden 20/dk'yi aninda tuketiyordu.
 */
const HIT_PER_IP = 120;
const MISS_PER_IP = 20;
const UPSTREAM_GLOBAL = 60;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < GEOCODE_MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const ip = await getClientIp(req);
  const locale = resolveRequestLocale(req.headers.get("accept-language"));
  // Rezervasyon alinan butun noktalar Turkiye'de: arama oraya sinirli, bes sonuc.
  const cacheKey = geocodeCacheKey(q, locale, "tr:5");
  let places = await getCachedPlaces(cacheKey);

  if (places) {
    if (!(await rateLimit(`mobile_geocode_hit:${ip}`, HIT_PER_IP, 60_000))) return tooMany();
  } else {
    if (!(await rateLimit(`mobile_geocode:${ip}`, MISS_PER_IP, 60_000))) return tooMany();
    if (!(await rateLimit("mobile_geocode_upstream", UPSTREAM_GLOBAL, 60_000))) return tooMany();
    const result = await geocodePlaces(q, locale, { countryCodes: "tr", limit: 5 });
    if (!result.ok) return NextResponse.json({ error: "geocode_unavailable" }, { status: 503 });
    places = result.places;
    await setCachedPlaces(cacheKey, places);
  }

  if (places.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Ust duzey alanlar eski uygulama icin (tek sonuc); yeni uygulama `items`i okur.
  return NextResponse.json({
    ...toMobileGeocodeResult(places[0]),
    items: places.map(toMobileGeocodeResult),
  });
}

function tooMany() {
  return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
}
