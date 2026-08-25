"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import { useLocale, useTranslations } from "next-intl";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

/**
 * AnalyticsChart — son 7 gün (parent’tan gelen veri).
 */
interface TooltipEntry {
  dataKey?: string | number;
  name?: NameType;
  value?: ValueType;
  color?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  // Hook erken dönüşten ÖNCE (React kuralları).
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);

  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-4 py-3 text-xs font-bold">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}:{" "}
          {typeof entry.value === "number"
            ? new Intl.NumberFormat(dateLocale).format(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsChart({
  data,
}: {
  data: { name: string; ciro: number; emanet: number }[];
}) {
  const t = useTranslations("Admin");
  const chartData = data?.length ? data : [];

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-xs id-eyebrow text-gray-400">
        {t("dashboardChartEmpty")}
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorCiro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: "#9ca3af" }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: "#9ca3af" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="ciro"
            name={t("chartRevenue")}
            stroke="#f97316"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorCiro)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
