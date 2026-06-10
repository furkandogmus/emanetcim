import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";
import { BookingStatus, PaymentStatus } from "@prisma/client";

export async function GET() {
  const session = await getMobileSession();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shop.findFirst({
    where: { ownerId: session.userId },
  });

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseWhere = {
    shopId: shop.id,
    status: { in: [BookingStatus.PAID, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
    paymentLog: { is: { status: PaymentStatus.SUCCESS } },
  };

  const [aggregateResult, todayResult, history] = await Promise.all([
    // Tüm zamanların toplam cirosu
    prisma.booking.aggregate({
      where: baseWhere,
      _sum: { totalPrice: true },
    }),
    // Bugünkü ciro — tam tarih filtresiyle, son 10 kayıt sınırı olmaksızın
    prisma.booking.aggregate({
      where: { ...baseWhere, createdAt: { gte: today } },
      _sum: { totalPrice: true },
    }),
    // Son 10 işlem (geçmiş listesi için)
    prisma.booking.findMany({
      where: baseWhere,
      select: { totalPrice: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalEarnings = Number(aggregateResult._sum?.totalPrice ?? 0);
  const todayEarnings = Number(todayResult._sum?.totalPrice ?? 0);

  const formattedHistory = history.map((b) => ({
    date: b.createdAt.toISOString().slice(5, 10).replace("-", " "),
    amount: Number(b.totalPrice),
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
