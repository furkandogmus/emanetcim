import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const userId = auth.user.id;

  const [totalBookings, completedBookings, totalSpent] = await Promise.all([
    prisma.booking.count({ where: { guestId: userId } }),
    prisma.booking.count({ where: { guestId: userId, status: "CHECKED_OUT" } }),
    prisma.booking.aggregate({
      where: { guestId: userId, status: { not: "CANCELLED" } },
      _sum: { totalPrice: true },
    }),
  ]);

  return NextResponse.json({
    totalBookings,
    completedBookings,
    totalSavings: 0,
    totalSpent: Number(totalSpent._sum.totalPrice ?? 0),
  });
}
