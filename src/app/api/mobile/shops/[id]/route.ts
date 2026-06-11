import { NextResponse } from "next/server";
import { ShopService } from "@/services/ShopService";

const shopService = new ShopService();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await shopService.getShopDetails(id);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
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
    image: s.image,
  });
}
