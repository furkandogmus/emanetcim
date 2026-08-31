"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  Receipt,
  Clock,
  Star,
  BarChart3,
  RefreshCw,
  Store,
  ArrowRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import { formatDecimal, formatTryCurrency } from "@/lib/currency";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

interface RecentBooking {
  id: string;
  totalPrice: number;
  createdAt: string;
  guestName: string | null;
}

interface MonthSummary {
  month: string;
  grossTotal: number;
  netTotal: number;
  commissionTotal: number;
  count: number;
}

interface PeakHour {
  hour: string;
  count: number;
}

interface Props {
  shopName: string;
  shops: { id: string; name: string }[];
  activeShopId: string;
  merchantRatio: number;
  totalGross: number;
  totalNet: number;
  monthly: MonthSummary[];
  peakHoursData: PeakHour[];
  avgStayHours: number;
  conversionRate: number;
  avgRating: number;
  /**
   * Ayarda YAZAN komisyon yüzdesi — henüz yürürlükte olmayabilir.
   * Yalnızca "online ödeme başlayınca %X olacak" demek için.
   */
  configuredCommissionPct: number;
  recent: RecentBooking[];
  recentLimit: number;
}

/**
 * Grafikler AYRI PARÇADA (performans).
 *
 * `recharts` ~340 KB ve bu sayfanın ilk JS yükünün içindeydi. Esnafın önce
 * gördüğü şey üstteki kazanç kartları; iki grafik de katlamanın altında ve
 * veri yoksa hiç çizilmiyor. `AdminDashboardClient` → `AnalyticsChart` ile
 * aynı kalıp.
 */
const CHART_SKELETON_CLASS = "w-full bg-gray-50/50 rounded-2xl animate-pulse";

const MonthlyNetChart = dynamic(
  () =>
    import("@/components/partner/PartnerEarningsCharts").then(
      (m) => m.MonthlyNetChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className={CHART_SKELETON_CLASS} style={{ height: 160 }} />
    ),
  },
);

const PeakHoursChart = dynamic(
  () =>
    import("@/components/partner/PartnerEarningsCharts").then(
      (m) => m.PeakHoursChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className={CHART_SKELETON_CLASS} style={{ height: 140 }} />
    ),
  },
);

export default function PartnerEarningsClient({
  shopName,
  shops,
  activeShopId,
  merchantRatio,
  totalGross,
  totalNet,
  monthly,
  peakHoursData,
  avgStayHours,
  conversionRate,
  avgRating,
  configuredCommissionPct,
  recent,
  recentLimit,
}: Props) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const bcp47 = bcp47ForUiLocale(locale);
  const commissionPct = Math.round((1 - merchantRatio) * 100);
  /**
   * Komisyon GERÇEKTEN kesiliyor mu?
   *
   * Ölçüt SAĞLAYICI DEĞİL, ORANIN KENDİSİ. Kural `platform-split.ts` →
   * `effectiveCommissionRate`'te: tahsilatı platform yapmıyorsa oran zaten 0'a
   * düşüyor. Ekranın ayrıca "sağlayıcı hangisi" diye sorması, aynı kuralın
   * ikinci bir kopyası olurdu — ve oran başka bir sebeple 0 olduğunda
   * (kampanya, ayar) bu kopya yanlış metni gösterirdi.
   */
  const commissionActive = commissionPct > 0;


  /*
    Para birimi ARTIK ELLE "₺" DEĞİL. Önceki hâl `{fmt(x)} ₺` yazıyordu: sembol
    her dilde sona yapışıyordu, oysa yerleşim dile göre değişir (fr-FR "1 234,00 ₺",
    ja-JP "₺1,234.00"). `formatTryCurrency` zaten bu iş için var.
  */
  const money = (n: number) => formatTryCurrency(n, bcp47);
  const fmtPlain = (n: number) =>
    n.toLocaleString(bcp47, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMonth = (key: string) => {
    const [year, month] = key.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleString(bcp47, { month: "long", year: "numeric" });
  };

  const activePeakHours = peakHoursData.filter((h) => h.count > 0);
  /** Grafikte en yeni 6 ay, soldan sağa eskiden yeniye. `slice` kopya üretir. */
  const monthlyChartData = monthly.slice(0, 6).reverse();

  return (
    <div className="bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/partner" className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900">{t("earnings")}</h1>
            <p className="text-sm text-gray-500">{shopName}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/*
          ÇOK DÜKKANLI ESNAF. Panel `?shop=` ile dükkan değiştirebiliyordu ama bu
          sayfa onu hiç okumuyor, `findFirst` ile rastgele birini gösteriyordu —
          esnaf Sultanahmet'i seçip Galata'nın rakamlarına bakıyordu. Seçim artık
          burada da görünür ve aynı parametreyi taşır.
        */}
        {shops.length > 1 && (
          <nav aria-label={t("earningsShopSwitcher")} className="flex gap-2 overflow-x-auto pb-1">
            {shops.map((s) => {
              const active = s.id === activeShopId;
              return (
                <Link
                  key={s.id}
                  href={`/partner/earnings?shop=${s.id}`}
                  aria-current={active ? "page" : undefined}
                  /* Renk KİMLİK KATMANINDAN (`.id-accent-soft`), elle `orange-*` değil. */
                  className={`id-pill flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? "id-accent-soft id-accent-border"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Store className="h-3.5 w-3.5" />
                  {s.name}
                </Link>
              );
            })}
          </nav>
        )}

        {/*
          KOMISYONSUZ DÖNEMDE İKİ KART AYNI SAYIYI GÖSTERİR.

          Komisyon yürürlükte değilken (`commissionActive === false`) brüt ile net
          birebir eşittir; yan yana iki özdeş rakam basmak esnafa ikisinin farklı
          şeyler olduğunu düşündürür ve "acaba nerede kesinti var" diye aratır.
          Tek kart, tek sayı, tek cümle.
        */}
        {commissionActive ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  {t("earningsGross")}
                </span>
              </div>
              <p className="text-2xl font-black text-gray-900">{money(totalGross)}</p>
              <p className="text-xs text-gray-400 mt-1">{t("earningsCommissionIncluded")}</p>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-600 uppercase tracking-wider">
                  {t("netEarningsShort")}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700">{money(totalNet)}</p>
              <p className="text-xs text-emerald-500 mt-1">
                {t("earningsYourShare", { share: 100 - commissionPct })}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              <span className="text-xs uppercase tracking-wider text-emerald-600">
                {t("earningsAllYoursTitle")}
              </span>
            </div>
            <p className="id-display mt-2 text-4xl text-emerald-700">{money(totalGross)}</p>
            <p className="mt-2 text-sm font-semibold text-emerald-700">
              {t("earningsZeroCommissionNote")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">{avgStayHours}s</p>
            <p className="text-xs text-gray-400">{t("earningsAvgDuration")}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <RefreshCw className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">%{conversionRate}</p>
            <p className="text-xs text-gray-400">{t("earningsConversion")}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">
              {avgRating > 0 ? formatDecimal(avgRating, locale) : "—"}
            </p>
            <p className="text-xs text-gray-400">{t("earningsRating")}</p>
          </div>
        </div>

        {/*
          KOMİSYON KUTUSU. Yürürlükteki durumu anlatır, ayarda yazanı değil.

          Eski hâli koşulsuz "her ödemeden %{commission} platform payı düşülür,
          %{share} hesabınıza aktarılır" diyordu. Dükkanda tahsilatta bu cümlenin
          İKİ ayrı yanlışı vardı: hiçbir şey düşülmüyor (komisyon yürürlükte
          değil) ve hiçbir şey "hesabınıza aktarılmıyor" (para zaten kasada).
        */}
        {commissionActive ? (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
            <Receipt className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">
                {t("earningsCommissionTitle", { commission: commissionPct })}
              </span>
              {" — "}
              {t("earningsSplitNote", {
                commission: commissionPct,
                share: 100 - commissionPct,
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4">
            <Receipt className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">
                {t("earningsNoCommissionTitle")}
              </span>
              {" — "}
              {configuredCommissionPct > 0
                ? t("earningsNoCommissionBodyFuture", { commission: configuredCommissionPct })
                : t("earningsNoCommissionBody")}
            </div>
          </div>
        )}

        {monthly.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{t("earningsMonthlySummary")}</h2>
            </div>
            <div className="px-4 pt-4 pb-2">
              <MonthlyNetChart
                data={monthlyChartData}
                formatAmount={fmtPlain}
                formatMonth={fmtMonth}
              />
            </div>
            <div className="divide-y divide-gray-50">
              {monthly.map((m) => (
                <div key={m.month} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{fmtMonth(m.month)}</p>
                    <p className="text-xs text-gray-400">
                      {t("earningsReservationCount", { count: m.count })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{money(m.netTotal)}</p>
                    <p className="text-xs text-gray-400">
                      {commissionActive
                        ? t("earningsGrossSuffix", { amount: fmtPlain(m.grossTotal) })
                        : t("earningsReservationCount", { count: m.count })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activePeakHours.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-gray-900">{t("earningsPeakHoursTitle")}</h2>
            </div>
            <div className="px-4 pt-4 pb-2">
              <PeakHoursChart
                data={peakHoursData}
                formatCount={(n) => t("earningsReservationCount", { count: n })}
              />
            </div>
          </div>
        )}

        {/* Son işlemler — ARŞİV DEĞİL. Tam geçmiş sayfalanmış hâlde /partner/bookings'te. */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">{t("transactionHistory")}</h2>
            <p className="text-xs text-gray-400">
              {t("earningsRecentNote", { count: recentLimit })}
            </p>
          </div>
          {recent.length === 0 ? (
            <p className="text-center text-gray-400 py-10">{t("noTransactionsYet")}</p>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {recent.map((b) => {
                  const net = Math.round(b.totalPrice * merchantRatio * 100) / 100;
                  const date = new Date(b.createdAt).toLocaleDateString(bcp47);
                  return (
                    <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {b.guestName ?? t("guestFallback", { id: b.id.slice(0, 6) })}
                        </p>
                        <p className="text-xs text-gray-400">{date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">{money(net)}</p>
                        <p className="text-xs text-gray-400">
                          {t("earningsGrossSuffix", { amount: fmtPlain(b.totalPrice) })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link
                href="/partner/bookings"
                className="id-accent flex items-center justify-center gap-1.5 border-t border-gray-100 px-4 py-3 text-sm font-bold transition-colors hover:bg-gray-50"
              >
                {t("earningsSeeAllBookings")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
