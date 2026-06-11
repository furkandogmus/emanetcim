"use server";

import { shopService } from "@/services/ShopService";
import { validateBookingStayWindow } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import {
  SEARCH_DEFAULT_CENTER,
  SEARCH_NEARBY_RADIUS_KM,
} from "@/lib/search-defaults";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { roundedSlotPrices } from "@/lib/bag-pricing";

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
      radiusKm: null,
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

  return {
    ok: true as const,
    nearby: JSON.parse(JSON.stringify(withSlots(nearby))) as unknown[],
    all: JSON.parse(JSON.stringify(withSlots(all))) as unknown[],
  };
}
