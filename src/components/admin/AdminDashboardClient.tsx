"use client";

import type { ReactNode } from "react";
import {
  Briefcase,
  Wallet,
  MapPin,
  ChevronRight,
  Package,
} from "lucide-react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

const AnalyticsChart = dynamic(
  () => import("@/components/admin/AnalyticsChart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[300px] bg-gray-50/50 rounded-3xl animate-pulse" />
    ),
  }
);

type ChartRow = { name: string; ciro: number; emanet: number };

interface AdminDashboardClientProps {
  stats: {
    totalBookings: string;
    dailyRevenue: string;
    activePartners: number;
    pendingApplications: number;
    trends: {
      bookings: string;
      revenue: string;
      partners: string;
    };
  };
  activeShops: any[];
  chartData: ChartRow[];
}

export default function AdminDashboardClient({
  stats,
  activeShops,
  chartData,
}: AdminDashboardClientProps) {
  const t = useTranslations("Admin");

  return (
    <div className="min-h-screen bg-gray-50 p-10 font-sans">
      <header className="mb-10">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl font-black tracking-tighter text-gray-900"
        >
          {t("dashboardTitle")}
        </motion.h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <StatCard
          delay={0.1}
          title={t("totalBookings")}
          value={stats.totalBookings}
          icon={<Briefcase size={24} />}
          trend={stats.trends.bookings}
        />
        <StatCard
          delay={0.2}
          title={t("dailyRevenue")}
          value={stats.dailyRevenue}
          icon={<Wallet size={24} />}
          trend={stats.trends.revenue}
          isOrange
        />
        <StatCard
          delay={0.3}
          title={t("activePartners")}
          value={stats.activePartners.toString()}
          icon={<MapPin size={24} />}
          trend={stats.trends.partners}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="mb-6 flex justify-between items-center px-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">
                {t("dashboardLiveAnalytics")}
              </h3>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {t("systemActive")}
                </span>
              </div>
            </div>
            <div className="h-[300px]">
              <AnalyticsChart data={chartData} />
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 px-2">
              {t("partnerStatus")}
            </h3>
            <div className="flex flex-col gap-3">
              {activeShops.map((shop, i) => (
                <div
                  key={shop.id || i}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-2 h-2 rounded-full ${shop.isActive ? "bg-green-500" : "bg-gray-300"}`}
                    ></div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{shop.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {shop.address?.substring(0, 30) || t("defaultCityFallback")}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-black text-gray-900">
                        {shop._count?.bookings || 0} / {shop.capacity || 20}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {t("occupancy")}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-gray-600 transition-colors"
                    />
                  </div>
                </div>
              ))}
              {activeShops.length === 0 && (
                <p className="text-center py-10 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {t("noActivePartners")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-2xl shadow-gray-200 h-fit lg:sticky lg:top-10">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest opacity-40 mb-6">
              {t("quickActions")}
            </h3>
            <div className="flex flex-col gap-4">
              <Link
                href="/admin/applications"
                className="w-full py-4 px-6 bg-white/10 rounded-2xl text-sm font-bold hover:bg-white/20 transition-all text-left flex items-center justify-between group"
              >
                {t("approveShop")}
                <span className="w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center text-[10px] group-hover:scale-110 transition-transform">
                  {stats.pendingApplications}
                </span>
              </Link>
              <Link
                href="/admin/seals"
                className="w-full py-4 px-6 bg-white/10 rounded-2xl text-sm font-bold hover:bg-white/20 transition-all text-left"
              >
                {t("sealRequests")}
              </Link>
              <Link
                href="/admin/campaigns"
                className="w-full py-4 px-6 bg-white/10 rounded-2xl text-sm font-bold hover:bg-white/20 transition-all text-left"
              >
                {t("createCampaign")}
              </Link>
              <Link
                href="/admin/platform-settings"
                className="w-full py-4 px-6 bg-white/10 rounded-2xl text-sm font-bold hover:bg-white/20 transition-all text-left"
              >
                {t("platformSettingsNav")}
              </Link>
            </div>
          </div>
          <div className="pt-8 mt-8 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
              {t("versionLabel")}
            </span>
            <div className="p-2 bg-orange-600 rounded-lg">
              <Package size={16} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
  isOrange = false,
  delay = 0,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: string;
  isOrange?: boolean;
  delay?: number;
}) {
  const t = useTranslations("Admin");
  const showTrend = trend && trend !== t("trendNone");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all"
    >
      <div className="flex items-center gap-4 text-gray-400 mb-6">
        <div
          className={`p-4 rounded-2xl ${isOrange ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-900"}`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest leading-none">
          {title}
        </span>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span
          className={`text-4xl font-black ${isOrange ? "text-orange-600" : "text-gray-900"}`}
        >
          {value}
        </span>
        {showTrend ? (
          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg max-w-[14rem] leading-snug">
            {trend}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
