import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { shopService } from "@/services/ShopService";
import { validateBookingStayWindow } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { toMobileShop } from "@/lib/mobile-dto";

const schema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  r: z.coerce.number().default(5000),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  bags: z.coerce.number().optional(),
});

export async function GET(req: NextRequest) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`mobile_shops_nearby:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { lat, lng, r, page, limit, checkIn, checkOut, bags } = parsed.data;

  const radiusKm = r / 1000;

  if (checkIn && checkOut) {
    const rules = await getPricingRules();
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (!validateBookingStayWindow(ci, co, rules)) {
      return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
    }
    const requestedBags = Math.max(1, Math.floor(bags ?? 1));
    const results = await shopService.findShopsForSearch({
      centerLat: lat,
      centerLng: lng,
      radiusKm,
      checkIn: ci,
      checkOut: co,
      requestedBags,
    });
    return NextResponse.json(
      results.slice((page - 1) * limit, page * limit).map((s) => ({
        ...toMobileShop(s),
        /* Aramaya OZGU alanlar: ortak govdeye girmez, listede anlamli. */
        distanceKm: s.distanceKm,
        bagsAvailable: s.bagsAvailable,
      })),
    );
  }

  const shops = await shopService.findNearby(lat, lng, radiusKm, page, limit);
  return NextResponse.json(
    shops.map((s) => ({
      ...toMobileShop(s),
      distanceKm: s.distanceKm,
    })),
  );
}
