"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * Kazanç sayfasının iki `recharts` grafiği.
 *
 * NEDEN AYRI DOSYA (performans): `recharts` derlenmiş hâlde ~340 KB ve
 * `PartnerEarningsClient` içinde statik `import` ediliyordu — yani sayfanın ilk
 * JS yükünün içindeydi. Oysa esnafın önce gördüğü şey üstteki kazanç
 * kartlarıdır; grafikler katlamanın altında, üstelik ikisi de veri yoksa hiç
 * çizilmiyor. Ayrı dosya, `next/dynamic`'in bu 340 KB'ı kendi parçasına
 * taşımasını mümkün kılar (aynı kalıp: `AdminDashboardClient` → `AnalyticsChart`).
 *
 * Biçimlendiriciler PROP olarak geliyor: `fmt`/`fmtMonth` çağıran bileşende
 * kalsın ki tutar ve tarih biçimi tek yerde tanımlı olsun.
 */

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  fontSize: 12,
} as const;

const AXIS_TICK = { fontSize: 11, fill: "#9ca3af" } as const;

interface MonthlyNetChartProps {
  data: Array<{ month: string; netTotal: number }>;
  formatAmount: (n: number) => string;
  formatMonth: (key: string) => string;
}

export function MonthlyNetChart({
  data,
  formatAmount,
  formatMonth,
}: MonthlyNetChartProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis
          dataKey="month"
          tickFormatter={(v) => {
            const [, m] = v.split("-");
            return `${m}.ay`;
          }}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          formatter={(v) => [`${formatAmount(Number(v))} ₺`, "Net"]}
          labelFormatter={(l) => formatMonth(l as string)}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="netTotal" fill="#10b981" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PeakHoursChartProps {
  data: Array<{ hour: string; count: number }>;
  /** "3 rezervasyon" gibi tek satırlık ipucu metni. */
  formatCount: (count: number) => string;
}

export function PeakHoursChart({ data, formatCount }: PeakHoursChartProps) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} barSize={8}>
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
          formatter={(v) => [formatCount(Number(v)), ""]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
