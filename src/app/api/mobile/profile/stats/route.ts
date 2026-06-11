import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const userId = auth.user.id;

  const [totalBookings, totalSpent, favoritesCount] = await Promise.all([
    prisma.booking.count({
      where: { guestId: userId, status: { not: "CANCELLED" } },
    }),
    prisma.booking.aggregate({
      where: { guestId: userId, status: { not: "CANCELLED" } },
      _sum: { totalPrice: true },
    }),
    prisma.booking.count({
      where: { guestId: userId, status: { in: ["PAID", "CHECKED_IN", "CHECKED_OUT"] } },
    }),
  ]);

  return NextResponse.json({
    totalBookings,
    totalSavings: Number(totalSpent._sum?.totalPrice ?? 0) * 0.15,
    favoritesCount,
    completedBookings: favoritesCount,
  });
}
