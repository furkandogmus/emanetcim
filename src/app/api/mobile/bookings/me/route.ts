import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const list = await bookingService.getUserBookings(auth.user.id, { page, limit });
  return NextResponse.json(
    list.items.map((b) => ({
      id: b.id,
      shopId: b.shopId,
      shopName: b.shop.name,
      checkInTime: b.checkInTime,
      checkOutTime: b.checkOutTime,
      bagCountS: b.bagCountS,
      bagCountM: b.bagCountM,
      bagCountXl: b.bagCountXl,
      totalPrice: Number(b.totalPrice),
      status: b.status,
    })),
  );
}
