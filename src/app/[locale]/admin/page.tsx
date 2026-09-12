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
import { dayRangeInTimeZone, startOfDayInTimeZone } from "@/lib/timezone";

/**
 * Ciroya sayılan durumlar. Partner panelindekiyle AYNI küme olmak zorunda —
 * yoksa admin ile esnaf farklı rakam görür. Tek doğru kaynak: platform-split.ts
 * (2026-08-22'de partner panelinin iki ekranı tam bu yüzden 710 TL ve 490 TL
 * gösteriyordu; bu üçüncü kopyaydı).
 */
const PAID_STATUSES = EARNING_BOOKING_STATUSES;

/**
 * Admin panelinin gün sınırı.
 *
 * NEDEN VAR: buradaki tüm gün kovaları `setHours(...)` ile kuruluyordu, yani
 * SUNUCUNUN yerel saatinde. Üretim konteyneri UTC çalıştığı için "bugün"
 * İstanbul'da 03:00'te başlıyordu — esnaf paneli (`PartnerDashboardService`,
 * mobil kazanç ucu) ise `src/lib/timezone.ts` ile dükkanın dilimini kullanıyor.
 * Sonuç: aynı rezervasyon admin ile esnafta FARKLI güne düşebiliyordu ve
 * gece yarısı sonrası açılan iki panel birbirini tutmuyordu.
 *
 * Admin platformun tamamına bakar, tek bir dükkanın dilimi yoktur; platformun
 * ana dilimi esnaf tarafındaki `safeTimezone` yedeğiyle AYNI değer olmak
 * zorunda, yoksa aynı sapma başka bir kılıkta geri gelir.
 */
const PLATFORM_TIMEZONE = "Europe/Istanbul";

/**
 * `at` anının PLATFORM_TIMEZONE'daki takvim günü, grafik ekseninde göründüğü
 * gibi: `gün/ay`. Anahtar da etiket de aynı yerden üretilir ki kova ile eksen
 * asla ayrışmasın.
 */
function dayKeyInTimeZone(at: Date): string {
  const [, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .split("-")
    .map(Number);
  return `${day}/${month}`;
}

/**
 * `daysAgo` gün önceki günün PLATFORM_TIMEZONE'daki 00:00'ı.
 *
 * Gece yarısından 24 saat çıkarmak yerine o günün ÖĞLENİNDEN geriye sayılıyor:
 * yaz saati geçişinin olduğu gün 23 ya da 25 saattir, tam gece yarısından
 * sabit 24 saat çıkarmak o hafta bir günü tekrarlar ya da atlar.
 */
function startOfDaysAgo(todayStart: Date, daysAgo: number): Date {
  const HOUR = 60 * 60 * 1000;
  return startOfDayInTimeZone(
    PLATFORM_TIMEZONE,
    new Date(todayStart.getTime() + 12 * HOUR - daysAgo * 24 * HOUR),
  );
}

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

async function getDailyChartData(now: Date = new Date()) {
  const today = dayRangeInTimeZone(PLATFORM_TIMEZONE, now);

  /*
    Grafiğin yedi sütunu: bugün dahil, geriye altı gün. Sınırlar da anahtarlar
    da İstanbul saatinde üretiliyor; eskiden sorgu penceresi sunucunun yerel
    gece yarısıyla, kova anahtarı ise `d.getDate()` ile — yani yine sunucunun
    dilimiyle — kuruluyordu. UTC sunucuda İstanbul'un 00:00-03:00 arası
    rezervasyonları bir önceki sütuna düşüyordu.
  */
  const dayStarts: Date[] = [];
  for (let i = 6; i >= 0; i--) dayStarts.push(startOfDaysAgo(today.start, i));

  const bookings = await prisma.booking.findMany({
    where: {
      // Yarı açık aralık: `lte: 23:59:59.999` son milisaniyeyi kaybediyordu.
      createdAt: { gte: dayStarts[0], lt: today.end },
      status: { in: [...PAID_STATUSES] },
    },
    select: { createdAt: true, totalPrice: true },
  });

  const dayBuckets: Record<string, { total: number; count: number }> = {};
  for (const b of bookings) {
    const key = dayKeyInTimeZone(new Date(b.createdAt));
    if (!dayBuckets[key]) dayBuckets[key] = { total: 0, count: 0 };
    dayBuckets[key].total += moneyToNumber(b.totalPrice);
    dayBuckets[key].count++;
  }

  return dayStarts.map((dayStart) => {
    const key = dayKeyInTimeZone(dayStart);
    const bucket = dayBuckets[key];
    return {
      name: key,
      ciro: bucket ? Math.round(bucket.total) : 0,
      emanet: bucket ? bucket.count : 0,
    };
  });
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
