import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
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

  const shopIds = shops.map((s) => s.id);
  const shopMap = new Map(shops.map((s) => [s.id, s.name]));

  const allBookings = await prisma.booking.findMany({
    where: { shopId: { in: shopIds } },
    include: { guest: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const results = allBookings.map((b) => ({
    id: b.id,
    shopId: b.shopId,
    shopName: shopMap.get(b.shopId) ?? "",
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

  return NextResponse.json(results);
}
