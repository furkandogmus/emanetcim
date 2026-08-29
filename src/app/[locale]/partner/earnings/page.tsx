import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import {
  getMerchantShareRatio,
  EARNING_BOOKING_STATUSES,
} from "@/lib/platform-split";
import { getPricingRules } from "@/lib/platform-settings";
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
    select: { id: true, name: true, rating: true },
  });

  if (!shop) {
    redirect(`/${locale}/partner`);
  }

  const [bookings, allRequests] = await Promise.all([
    prisma.booking.findMany({
      where: {
        shopId: shop.id,
        // Ana panelle aynı tanım — tek doğru kaynak platform-split.ts'te.
        status: { in: [...EARNING_BOOKING_STATUSES] },
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
    }),
    prisma.booking.count({ where: { shopId: shop.id } }),
  ]);

  // Oran artik merkezi is kurallarindan geliyor (onbellekli); ortam degiskeni
  // kaybolunca sessizce %50'ye dusen eski davranis kapandi.
  const pricingRules = await getPricingRules();
  const merchantRatio = getMerchantShareRatio(pricingRules.platformCommissionRate);

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

  // Peak hours: group check-in hours (0-23)
  const peakHours: Record<number, number> = {};
  for (const b of bookings) {
    const h = new Date(b.checkInTime).getHours();
    peakHours[h] = (peakHours[h] ?? 0) + 1;
  }
  const peakHoursData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    count: peakHours[h] ?? 0,
  }));

  // Avg stay duration (hours)
  const avgStayHours =
    bookings.length > 0
      ? Math.round(
          bookings.reduce((s, b) => {
            const ms = new Date(b.checkOutTime).getTime() - new Date(b.checkInTime).getTime();
            return s + ms / 3_600_000;
          }, 0) / bookings.length
        )
      : 0;

  // Conversion rate: paid bookings / all requests
  const conversionRate = allRequests > 0 ? Math.round((bookings.length / allRequests) * 100) : 0;

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
      peakHoursData={peakHoursData}
      avgStayHours={avgStayHours}
      conversionRate={conversionRate}
      avgRating={shop.rating ?? 0}
    />
  );
}
