"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ArrowLeft, TrendingUp, Wallet, Receipt, Clock, Star, BarChart3, RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatDecimal } from "@/lib/currency";

interface Booking {
  id: string;
  totalPrice: number;
  checkInTime: string;
  checkOutTime: string;
  status: string;
  createdAt: string;
  guest: { name: string | null } | null;
}

interface MonthSummary {
  month: string;
  grossTotal: number;
  netTotal: number;
  count: number;
}

interface PeakHour {
  hour: string;
  count: number;
}

interface Props {
  shopName: string;
  merchantRatio: number;
  totalGross: number;
  totalNet: number;
  monthly: MonthSummary[];
  bookings: Booking[];
  peakHoursData: PeakHour[];
  avgStayHours: number;
  conversionRate: number;
  avgRating: number;
}

function fmt(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMonth(key: string) {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("tr-TR", { month: "long", year: "numeric" });
}

export default function PartnerEarningsClient({
  shopName,
  merchantRatio,
  totalGross,
  totalNet,
  monthly,
  bookings,
  peakHoursData,
  avgStayHours,
  conversionRate,
  avgRating,
}: Props) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const commissionPct = Math.round((1 - merchantRatio) * 100);

  // Only show hours with any activity for cleaner chart
  const activePeakHours = peakHoursData.filter((h) => h.count > 0);

  return (
    <div className="bg-gray-50">
      {/* Header */}
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
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Brüt Ciro</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{fmt(totalGross)} ₺</p>
            <p className="text-xs text-gray-400 mt-1">Platform komisyonu dahil</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-emerald-600 uppercase tracking-wider">{t("netEarningsShort")}</span>
            </div>
            <p className="text-2xl font-black text-emerald-700">{fmt(totalNet)} ₺</p>
            <p className="text-xs text-emerald-500 mt-1">%{100 - commissionPct} size kalır</p>
          </div>
        </div>

        {/* Analytics mini-stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">{avgStayHours}s</p>
            <p className="text-xs text-gray-400">Ort. Süre</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <RefreshCw className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">%{conversionRate}</p>
            <p className="text-xs text-gray-400">Dönüşüm</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">
              {avgRating > 0 ? formatDecimal(avgRating, locale) : "—"}
            </p>
            <p className="text-xs text-gray-400">Puan</p>
          </div>
        </div>

        {/* Commission info */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <Receipt className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Platform komisyonu %{commissionPct}</span>
            {" — "}her ödemeden %{commissionPct} platform payı düşülür, %{100 - commissionPct} hesabınıza aktarılır.
          </div>
        </div>

        {/* Monthly breakdown */}
        {monthly.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Aylık Özet</h2>
            </div>
            <div className="px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthly.slice(0, 6).reverse()} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v) => {
                      const [, m] = v.split("-");
                      return `${m}.ay`;
                    }}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => [`${fmt(Number(v))} ₺`, "Net"]}
                    labelFormatter={(l) => fmtMonth(l as string)}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="netTotal" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="divide-y divide-gray-50">
              {monthly.map((m) => (
                <div key={m.month} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{fmtMonth(m.month)}</p>
                    <p className="text-xs text-gray-400">{m.count} rezervasyon</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{fmt(m.netTotal)} ₺</p>
                    <p className="text-xs text-gray-400">{fmt(m.grossTotal)} ₺ brüt</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Peak hours chart */}
        {activePeakHours.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-gray-900">Check-in Saatleri</h2>
            </div>
            <div className="px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={peakHoursData} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => [`${v} rezervasyon`, ""]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Transaction list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">{t("transactionHistory")}</h2>
            <p className="text-xs text-gray-400">{t("transactionsCount", { count: bookings.length })}</p>
          </div>
          {bookings.length === 0 ? (
            <p className="text-center text-gray-400 py-10">{t("noTransactionsYet")}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {bookings.map((b) => {
                const gross = b.totalPrice;
                const net = Math.round(gross * merchantRatio * 100) / 100;
                const date = new Date(b.createdAt).toLocaleDateString("tr-TR");
                return (
                  <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {b.guest?.name ?? t("guestFallback", { id: b.id.slice(0, 6) })}
                      </p>
                      <p className="text-xs text-gray-400">{date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">{fmt(net)} ₺</p>
                      <p className="text-xs text-gray-400">{fmt(gross)} ₺ brüt</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
