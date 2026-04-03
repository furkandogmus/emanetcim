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
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * AnalyticsChart — son 7 gün (parent’tan gelen veri).
 */
export default function AnalyticsChart({
  data,
}: {
  data: { name: string; ciro: number; emanet: number }[];
}) {
  const t = useTranslations("Admin");
  const [mounted, setMounted] = useState(false);
  const chartData = data?.length ? data : [];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[300px] bg-gray-50/50 rounded-3xl animate-pulse" />
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-xs font-bold text-gray-400 uppercase tracking-widest">
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
          <Tooltip
            contentStyle={{
              borderRadius: "16px",
              border: "none",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          />
          <Area
            type="monotone"
            dataKey="ciro"
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
