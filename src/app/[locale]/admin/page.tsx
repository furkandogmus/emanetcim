import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { formatTryCurrency } from "@/lib/currency";
import { dayRangeInTimeZone } from "@/lib/timezone";
import { PLATFORM_TIMEZONE, adminOverviewService, startOfDaysAgo } from "@/services/AdminOverviewService";

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

/**
 * Gun sinirlari, gunluk seri ve `startOfDaysAgo` artik `AdminOverviewService`'te:
 * mobil yonetim ekrani ayni seriyi okur, iki kopya gun siniri ayrisirdi.
 */
async function getDailyChartData(now: Date = new Date()) {
  const points = await adminOverviewService.dailySeries(7, now);
  return points.map((p) => ({
    // Eksen etiketi eskisi gibi `gün/ay`.
    name: `${Number(p.date.slice(8, 10))}/${Number(p.date.slice(5, 7))}`,
    ciro: Math.round(p.revenue),
    emanet: p.bookings,
  }));
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
  const dateLocale = bcp47ForUiLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Admin");

  const now = new Date();
  // Haftalık pencereler de İstanbul gününde başlar — bkz. PLATFORM_TIMEZONE.
  const todayStart = dayRangeInTimeZone(PLATFORM_TIMEZONE, now).start;
  const start7 = startOfDaysAgo(todayStart, 7);
  const start14 = startOfDaysAgo(todayStart, 14);

  /*
    ILK DORT SORGU DA BURAYA TASINDI (2026-09-10'da bulundu): birbirini
    beklemeden calisabilecekken art arda sirali `await` ile (dort ayri
    round-trip) calistiriliyordu, hemen ALTINDAKI blok zaten sekiz sorguyu
    paralel yuruturken bunlar disarida kalmisti.
  */
  const [
    pendingApps,
    totalBookings,
    activePartnersCount,
    revenueData,
    shopsWeek,
    shopsPrev,
    chartData,
    pendingRoleApprovals,
  ] = await Promise.all([
    shopService.getPendingShops(),
    prisma.booking.count(),
    prisma.shop.count({ where: { isActive: true } }),
    prisma.booking.aggregate({
      where: { status: { in: [...PAID_STATUSES] } },
      _sum: { totalPrice: true },
    }),
    prisma.shop.count({ where: { createdAt: { gte: start7 } } }),
    prisma.shop.count({
      where: { createdAt: { gte: start14, lt: start7 } },
    }),
    getDailyChartData(now),
    prisma.adminRoleChangeRequest.count(),
  ]);
  const totalRevenue = moneyToNumber(revenueData._sum.totalPrice ?? 0);

  /**
   * Sayı biçimlendirmesi SUNUCUDA yapılıyor ve `toLocaleString()` locale ARGÜMANI
   * ALMIYORDU — yani sonuç, isteğin diline değil **sunucunun ICU varsayılanına**
   * bağlıydı. Farklı bir makinede `₺3.480` yerine `₺3,480` çıkar; istemci ile
   * sunucu ayrışırsa hydration uyuşmazlığı bile üretebilir.
   *
   * Ayrıca `Math.round` kuruşu atıyordu: 3.480,75 TRY ciro "₺3.481" görünüyordu.
   * Ciro ekranında yuvarlama, mutabakatta açıklanamayan fark demektir.
   */
  const stats = {
    totalBookings: new Intl.NumberFormat(dateLocale).format(totalBookings),
    /*
      `dailyRevenue` adı TARİHİ ve yanıltıcı: taşıdığı değer günlük değil, TÜM
      ZAMANLARIN ödenmiş cirosu — başlık da öyle diyor ("Ciro (ödenen)").
      Alan adı `AdminDashboardClient`'ın prop arayüzünde tanımlı olduğu için
      burada tek başına değiştirilemez; anlamı yazıldı ki bir sonraki okuyan
      "bugünün cirosu" sanıp yanına günlük bir karşılaştırma eklemesin.
    */
    dailyRevenue: formatTryCurrency(totalRevenue, dateLocale),
    activePartners: activePartnersCount,
    pendingApplications: pendingApps.length,
    trends: {
      /*
        EMANET ve CİRO KARTLARINDA TREND ROZETİ KALDIRILDI.

        Bu iki kartın değeri TÜM ZAMANLAR ("Toplam Emanet", "Ciro (ödenen)"),
        yanlarındaki yüzde ise SON 7 GÜN'ü bir önceki 7 güne kıyaslıyordu.
        Rakam ile yanındaki rozet aynı şeyi anlatmıyordu: 12.480 emanetin
        yanında "+%18" yazıyor, yönetici bunu toplamın %18 arttığı sanıyordu.

        İki çözüm vardı: (a) değeri son 7 güne indirmek, (b) trendi kaldırmak.
        (a) kart BAŞLIĞINI da yalancı duruma düşürürdü — başlıklar çeviri
        dosyasında "Toplam"/"Total" diyor ve `AdminDashboardClient` bu görevin
        dokunma izni dışında. Bu yüzden (b) seçildi: hiçbir metin değişmiyor,
        hiçbir rakamın anlamı kaymıyor, yalnızca eşleşmeyen rozet gidiyor.
        Haftalık kıyas gerekirse yeri /admin/analytics.

        `trendNone` (—) StatCard'ın rozeti gizlemek için zaten kullandığı
        değer; yeni anahtar ya da bileşen değişikliği gerekmiyor.
      */
      bookings: t("trendNone"),
      revenue: t("trendNone"),
      // Bu kartta rakam ile trend UYUMLU: değer aktif dükkan sayısı, trend o
      // sayıya haftalık katılan yeni dükkanlar. Olduğu gibi kalıyor.
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
