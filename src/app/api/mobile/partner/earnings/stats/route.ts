import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { BookingStatus, PaymentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const shops = await prisma.shop.findMany({
    where: { ownerId: auth.user.id, isActive: true },
    select: { id: true },
  });

  if (shops.length === 0) {
    return NextResponse.json({ error: "no_shops" }, { status: 404 });
  }

  const shopIds = shops.map((s) => s.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseWhere = {
    shopId: { in: shopIds },
    status: { in: [BookingStatus.PAID, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
    paymentLog: { is: { status: PaymentStatus.SUCCESS } },
  };

  const [aggregateResult, todayResult, history] = await Promise.all([
    prisma.booking.aggregate({
      where: baseWhere,
      _sum: { totalPrice: true },
    }),
    prisma.booking.aggregate({
      where: { ...baseWhere, createdAt: { gte: today } },
      _sum: { totalPrice: true },
    }),
    prisma.booking.findMany({
      where: baseWhere,
      select: { totalPrice: true, createdAt: true, shopId: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalEarnings = Number(aggregateResult._sum?.totalPrice ?? 0);
  const todayEarnings = Number(todayResult._sum?.totalPrice ?? 0);

  const formattedHistory = history.map((b) => ({
    date: b.createdAt.toISOString().slice(5, 10).replace("-", " "),
    amount: Number(b.totalPrice),
    shopId: b.shopId,
    status: "PAID" as const,
  }));

  return NextResponse.json({
    totalBalance: totalEarnings,
    todayEarnings,
    pendingPayout: 0,
    history: formattedHistory,
    currency: "TRY",
  });
}
