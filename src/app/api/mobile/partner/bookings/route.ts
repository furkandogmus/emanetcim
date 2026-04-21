import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const shops = await prisma.shop.findMany({
    where: { ownerId: auth.user.id },
    select: { id: true, name: true },
  });

  const results = await Promise.all(
    shops.map(async (shop) => {
      const items = await bookingService.getPartnerBookings(shop.id);
      return items.map((b) => ({
        id: b.id,
        shopId: shop.id,
        shopName: shop.name,
        checkInTime: b.checkInTime,
        checkOutTime: b.checkOutTime,
        bagCountS: b.bagCountS,
        bagCountM: b.bagCountM,
        bagCountXl: b.bagCountXl,
        totalPrice: Number(b.totalPrice),
        status: b.status,
        qrCodeToken: b.qrCodeToken,
        guestName: b.guest.name,
      }));
    }),
  );

  return NextResponse.json(results.flat());
}
