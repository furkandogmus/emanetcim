"use server";

import { shopService } from "@/services/ShopService";
import { validateBookingStayWindow } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import {
  SEARCH_ALL_RADIUS_KM,
  SEARCH_DEFAULT_CENTER,
  SEARCH_NEARBY_RADIUS_KM,
} from "@/lib/search-defaults";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { roundedSlotPrices } from "@/lib/bag-pricing";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import { auth } from "@/auth";

export async function refreshSearchShopsAction(input: {
  checkInIso: string;
  checkOutIso: string;
  requestedBags: number;
  centerLat?: number;
  centerLng?: number;
}) {
  const ip = await getClientIp();

  if (!(await rateLimit(`search_refresh:${ip}`, 30, 60_000))) {
    return { ok: false as const, error: "Errors.tooManyRequests" };
  }
  const rules = await getPricingRules();
  const checkIn = new Date(input.checkInIso);
  const checkOut = new Date(input.checkOutIso);

  if (!validateBookingStayWindow(checkIn, checkOut, rules)) {
    return { ok: false as const, error: "Errors.invalidBookingDates" };
  }

  const bags = Math.max(1, Math.floor(Number(input.requestedBags) || 1));

  const lat =
    input.centerLat != null && Number.isFinite(input.centerLat)
      ? input.centerLat
      : SEARCH_DEFAULT_CENTER.lat;
  const lng =
    input.centerLng != null && Number.isFinite(input.centerLng)
      ? input.centerLng
      : SEARCH_DEFAULT_CENTER.lng;

  const [nearby, all] = await Promise.all([
    shopService.findShopsForSearch({
      centerLat: lat,
      centerLng: lng,
      radiusKm: SEARCH_NEARBY_RADIUS_KM,
      checkIn,
      checkOut,
      requestedBags: bags,
    }),
    shopService.findShopsForSearch({
      centerLat: lat,
      centerLng: lng,
      // Sunucu sayfasiyla AYNI tavan: iki tasiyici ayni listeyi vermezse
      // ilk cizim ile ilk yenileme arasinda sonuc sayisi degisir.
      radiusKm: SEARCH_ALL_RADIUS_KM,
      checkIn,
      checkOut,
      requestedBags: bags,
    }),
  ]);

  const withSlots = (hits: { pricePerDay: number; [k: string]: unknown }[]) =>
    hits.map((h) => ({
      ...h,
      slotPrices: roundedSlotPrices(h.pricePerDay, rules),
    }));

  const session = await auth();
  analyticsService.track({
    name: "search_performed",
    sessionId: await resolveServerSessionId(session?.user?.id),
    userId: session?.user?.id ?? null,
    metadata: { resultCount: all.length, bags },
  });

  return {
    ok: true as const,
    nearby: JSON.parse(JSON.stringify(withSlots(nearby))) as unknown[],
    all: JSON.parse(JSON.stringify(withSlots(all))) as unknown[],
  };
}
