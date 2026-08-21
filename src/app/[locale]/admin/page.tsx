import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";

/**
 * Ciroya sayılan durumlar. Partner panelindekiyle AYNI küme olmak zorunda —
 * yoksa admin ile esnaf farklı rakam görür. Tek doğru kaynak: platform-split.ts
 * (2026-08-22'de partner panelinin iki ekranı tam bu yüzden 710 TL ve 490 TL
 * gösteriyordu; bu üçüncü kopyaydı).
 */
const PAID_STATUSES = EARNING_BOOKING_STATUSES;

function buildWeekOverWeekTrend(
  t: Awaited<ReturnType<typeof getTranslations>>,
  current: number,
  previous: number
): string {
  if (previous === 0 && current === 0) return t("trendNone");
  if (previous === 0) return t("trendPrev7Zero", { count: current });
  const raw = Math.round(((current - previous) / previous) * 100);
  const pctLabel = raw >= 0 ? `+${raw}` : `${raw}`;
  return t("trendWeekOverWeek", { pctLabel });
}

async function getDailyChartData() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      createdAt: { gte: sevenDaysAgo, lte: today },
      status: { in: [...PAID_STATUSES] },
    },
    select: { createdAt: true, totalPrice: true },
  });

  const dayBuckets: Record<string, { total: number; count: number }> = {};
  for (const b of bookings) {
    const d = new Date(b.createdAt);
    const key = `${d.getDate()}/${d.getMonth() + 1}`;
    if (!dayBuckets[key]) dayBuckets[key] = { total: 0, count: 0 };
    dayBuckets[key].total += moneyToNumber(b.totalPrice);
    dayBuckets[key].count++;
  }

  const out: { name: string; ciro: number; emanet: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = `${d.getDate()}/${d.getMonth() + 1}`;
    const bucket = dayBuckets[key];
    out.push({
      name: key,
      ciro: bucket ? Math.round(bucket.total) : 0,
      emanet: bucket ? bucket.count : 0,
    });
  }
  return out;
}

/**
 * Admin Dashboard - Yönetim Masası (Server Component)
 */
export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Admin");

  const pendingApps = await shopService.getPendingShops();
  const totalBookings = await prisma.booking.count();
  const activePartnersCount = await prisma.shop.count({ where: { isActive: true } });

  const revenueData = await prisma.booking.aggregate({
    where: { status: { in: [...PAID_STATUSES] } },
    _sum: { totalPrice: true },
  });
  const totalRevenue = moneyToNumber(revenueData._sum.totalPrice ?? 0);

  const now = new Date();
  const start7 = new Date(now);
  start7.setDate(start7.getDate() - 7);
  start7.setHours(0, 0, 0, 0);
  const start14 = new Date(start7);
  start14.setDate(start14.getDate() - 7);

  const [
    last7Bookings,
    prev7Bookings,
    last7Rev,
    prev7Rev,
    shopsWeek,
    shopsPrev,
    chartData,
    pendingRoleApprovals,
  ] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: start7 } } }),
    prisma.booking.count({
      where: { createdAt: { gte: start14, lt: start7 } },
    }),
    prisma.booking.aggregate({
      where: {
        createdAt: { gte: start7 },
        status: { in: [...PAID_STATUSES] },
      },
      _sum: { totalPrice: true },
    }),
    prisma.booking.aggregate({
      where: {
        createdAt: { gte: start14, lt: start7 },
        status: { in: [...PAID_STATUSES] },
      },
      _sum: { totalPrice: true },
    }),
    prisma.shop.count({ where: { createdAt: { gte: start7 } } }),
    prisma.shop.count({
      where: { createdAt: { gte: start14, lt: start7 } },
    }),
    getDailyChartData(),
    prisma.adminRoleChangeRequest.count(),
  ]);

  const stats = {
    totalBookings: totalBookings.toLocaleString(),
    dailyRevenue: `₺${Math.round(totalRevenue).toLocaleString()}`,
    activePartners: activePartnersCount,
    pendingApplications: pendingApps.length,
    trends: {
      bookings: buildWeekOverWeekTrend(t, last7Bookings, prev7Bookings),
      revenue: buildWeekOverWeekTrend(
        t,
        Math.round(moneyToNumber(last7Rev._sum.totalPrice ?? 0)),
        Math.round(moneyToNumber(prev7Rev._sum.totalPrice ?? 0))
      ),
      partners: buildWeekOverWeekTrend(t, shopsWeek, shopsPrev),
    },
  };

  return (
    <AdminDashboardClient
      stats={stats}
      chartData={chartData}
      pendingRoleApprovals={pendingRoleApprovals}
    />
  );
}
