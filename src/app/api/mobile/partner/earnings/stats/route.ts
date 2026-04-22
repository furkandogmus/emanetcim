import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";

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

  // Calculate stats
  const allPaidBookings = await prisma.booking.findMany({
    where: {
      shopId: shop.id,
      status: { in: ["PAID", "CHECKED_IN", "CHECKED_OUT"] },
      paymentLog: { is: { status: "SUCCESS" } },
    },
    select: { totalPrice: true, createdAt: true },
  });

  const totalEarnings = allPaidBookings.reduce(
    (sum, b) => sum + Number(b.totalPrice),
    0
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayEarnings = allPaidBookings
    .filter((b) => b.createdAt >= today)
    .reduce((sum, b) => sum + Number(b.totalPrice), 0);

  // For now, pending is just a placeholder or could be logic for split status
  const pendingEarnings = 0; 

  return NextResponse.json({
    totalBalance: totalEarnings,
    todayEarnings,
    pendingPayout: pendingEarnings,
    history: [], // For now empty to avoid crashes if UI expects list
    currency: "TRY",
  });
}
