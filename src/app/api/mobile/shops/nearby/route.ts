import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ShopService } from "@/services/ShopService";

const shopService = new ShopService();

const schema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  r: z.coerce.number().default(5000),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export async function GET(req: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { lat, lng, r, page, limit } = parsed.data;
  const radiusKm = r / 1000;
  const shops = await shopService.findNearby(lat, lng, radiusKm, page, limit);
  return NextResponse.json(
    shops.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      city: s.city,
      district: s.district,
      latitude: s.latitude,
      longitude: s.longitude,
      pricePerDay: Number(s.pricePerDay),
      capacity: s.capacity,
      rating: s.rating,
      openingTime: s.openingTime,
      closingTime: s.closingTime,
      open247: s.open247,
      hasRestroom: s.hasRestroom,
      isActive: s.isActive,
      distanceKm: s.distanceKm,
    })),
  );
}
