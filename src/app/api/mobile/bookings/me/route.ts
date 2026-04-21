import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const list = await bookingService.getUserBookings(auth.user.id);
  return NextResponse.json(
    list.map((b) => ({
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
      qrCodeToken: b.qrCodeToken,
    })),
  );
}
