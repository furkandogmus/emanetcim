import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [totalBookings, totalRevenueResult, totalPartners, pendingApps, unreadMessages] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.aggregate({
      where: { status: { in: ["PAID", "CHECKED_IN", "CHECKED_OUT"] } },
      _sum: { totalPrice: true },
    }),
    prisma.shop.count(),
    prisma.shop.count({ where: { isActive: false } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
  ]);

  return NextResponse.json({
    totalBookings,
    totalRevenue: Number(totalRevenueResult._sum.totalPrice || 0),
    totalPartners,
    pendingApplications: pendingApps,
    unreadMessages,
  });
}
