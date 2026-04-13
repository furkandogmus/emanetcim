import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { getMerchantShareRatio } from "@/lib/platform-split";
import PartnerEarningsClient from "@/components/partner/PartnerEarningsClient";

export default async function PartnerEarningsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== "PARTNER" && role !== "ADMIN")) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/partner/earnings`);
  }

  const shop = await prisma.shop.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });

  if (!shop) {
    redirect(`/${locale}/partner`);
  }

  const bookings = await prisma.booking.findMany({
    where: {
      shopId: shop.id,
      status: { in: ["PAID", "CHECKED_IN", "CHECKED_OUT"] },
    },
    select: {
      id: true,
      totalPrice: true,
      checkInTime: true,
      checkOutTime: true,
      status: true,
      createdAt: true,
      guest: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const merchantRatio = getMerchantShareRatio();

  // Group by month
  const monthMap: Record<
    string,
    { grossTotal: number; netTotal: number; count: number }
  > = {};

  for (const b of bookings) {
    const d = new Date(b.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const gross = moneyToNumber(b.totalPrice);
    const net = Math.round(gross * merchantRatio * 100) / 100;
    if (!monthMap[key]) monthMap[key] = { grossTotal: 0, netTotal: 0, count: 0 };
    monthMap[key].grossTotal += gross;
    monthMap[key].netTotal += net;
    monthMap[key].count += 1;
  }

  const monthly = Object.entries(monthMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, data]) => ({ month, ...data }));

  const totalGross = bookings.reduce(
    (s, b) => s + moneyToNumber(b.totalPrice),
    0
  );
  const totalNet = Math.round(totalGross * merchantRatio * 100) / 100;

  const serializedBookings = bookings.map((b) => ({
    ...b,
    totalPrice: moneyToNumber(b.totalPrice),
    checkInTime: b.checkInTime.toISOString(),
    checkOutTime: b.checkOutTime.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <PartnerEarningsClient
      shopName={shop.name}
      merchantRatio={merchantRatio}
      totalGross={totalGross}
      totalNet={totalNet}
      monthly={monthly}
      bookings={serializedBookings}
    />
  );
}
