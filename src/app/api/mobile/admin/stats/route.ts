import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET() {
  const session = await getMobileSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalBookings, totalRevenueResult, totalPartners, pendingApps, unreadMessages] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.aggregate({
      where: { status: { in: ["PAID", "CHECKED_IN", "CHECKED_OUT"] } },
      _sum: { totalPrice: true },
    }),
    prisma.shop.count(),
    prisma.shop.count({ where: { isActive: false } }), // Using isActive: false for pending
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
