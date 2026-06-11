import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const skip = (page - 1) * limit;

  const shops = await prisma.shop.findMany({
    where: { ownerId: auth.user.id },
    select: { id: true, name: true },
  });

  const shopIds = shops.map((s) => s.id);
  const shopMap = new Map(shops.map((s) => [s.id, s.name]));

  const [allBookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: { shopId: { in: shopIds } },
      include: { guest: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where: { shopId: { in: shopIds } } }),
  ]);

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
    guestName: b.guest?.name ?? "",
  }));

  return NextResponse.json({ items: results, total, page, limit });
}
