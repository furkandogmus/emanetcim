"use client";

import type { ReactNode } from "react";
import {
  Briefcase,
  Wallet,
  MapPin,
  Package,
  Store,
  ArrowRight,
  ShieldAlert,
  Activity,
  MessageSquare,
  Settings,
  Zap,
  TrendingUp,
  Flag,
  UserCog,
  Scale,
  BarChart3,
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
  chartData: ChartRow[];
  pendingRoleApprovals: number;
}

export default function AdminDashboardClient({
  stats,
  chartData,
  pendingRoleApprovals,
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
          <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-sm">
            <div className="mb-6 flex justify-between items-center px-2">
              <h3 className="text-sm id-eyebrow text-gray-400">
                {t("dashboardLiveAnalytics")}
              </h3>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="id-eyebrow text-gray-400">
                  {t("systemActive")}
                </span>
              </div>
            </div>
            <div className="h-[300px]">
              <AnalyticsChart data={chartData} />
            </div>
          </div>

          <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-sm">
            <h3 className="text-sm id-eyebrow text-gray-400 mb-6 px-2">
              {t("partnerStatus")}
            </h3>
            <div className="flex flex-col gap-3">
              <Link
                href="/admin/applications"
                className="group flex items-center justify-between p-5 bg-orange-50 hover:bg-orange-100 rounded-3xl transition-all border border-orange-100/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-600 shadow-sm group-hover:scale-110 transition-transform">
                    <Store size={24} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 tracking-tight">{t("applications")}</p>
                    <p className="id-eyebrow text-orange-600/60">{t("approveShop")}</p>
                  </div>
                </div>
                <ArrowRight className="text-orange-300 group-hover:translate-x-1 transition-transform" size={20} />
              </Link>

              <Link
                href="/admin/partners"
                className="group flex items-center justify-between p-5 bg-blue-50 hover:bg-blue-100 rounded-3xl transition-all border border-blue-100/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                    <Store size={24} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 tracking-tight">{t("shopManagement")}</p>
                    <p className="id-eyebrow text-blue-600/60">{t("activePartners")}</p>
                  </div>
                </div>
                <ArrowRight className="text-blue-300 group-hover:translate-x-1 transition-transform" size={20} />
              </Link>

              <Link
                href="/admin/users"
                className="group flex items-center justify-between p-5 bg-gray-50 hover:bg-gray-100 rounded-3xl transition-all border border-gray-100"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-600 shadow-sm group-hover:scale-110 transition-transform">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 tracking-tight">{t("usersManagement")}</p>
                    <p className="id-eyebrow text-gray-400">{t("banDeleteUsers")}</p>
                  </div>
                </div>
                <ArrowRight className="text-gray-300 group-hover:translate-x-1 transition-transform" size={20} />
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-4xl p-8 text-white flex flex-col justify-between shadow-2xl shadow-gray-200 h-fit lg:sticky lg:top-10">
          <div>
            <h3 className="text-sm id-eyebrow opacity-40 mb-6">
              {t("quickActions")}
            </h3>
            <div className="flex flex-col gap-4">
              <Link
                href="/admin/applications"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center justify-between group"
              >
                <span className="flex items-center gap-3">
                  <Package size={18} className="opacity-40" />
                  {t("approveShop")}
                </span>
                <span className="w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center text-[10px] group-hover:scale-110 transition-transform font-black">
                  {stats.pendingApplications}
                </span>
              </Link>
              <Link
                href="/admin/seals"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center gap-3"
              >
                <Zap size={18} className="opacity-40" />
                {t("sealRequests")}
              </Link>
              <Link
                href="/admin/campaigns"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center gap-3"
              >
                <TrendingUp size={18} className="opacity-40" />
                {t("createCampaign")}
              </Link>
              <Link
                href="/admin/status"
                className="w-full min-h-[3rem] px-5 bg-orange-600 rounded-2xl text-xs id-eyebrow transition-all text-left flex items-center justify-between group shadow-lg shadow-orange-900/40"
              >
                <span className="flex items-center gap-3">
                  <Activity size={18} />
                  {t("systemStatus")}
                </span>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </Link>
              <Link
                href="/admin/platform-settings"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center gap-3"
              >
                <Settings size={18} className="opacity-40" />
                {t("platformSettingsNav")}
              </Link>
              <Link
                href="/admin/feature-flags"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center gap-3"
              >
                <Flag size={18} className="opacity-40" />
                {t("featureFlagsNav")}
              </Link>
              <Link
                href="/admin/role-approvals"
                className={`w-full min-h-[3rem] px-5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all text-left flex items-center justify-between gap-3 ${
                  pendingRoleApprovals > 0
                    ? "bg-orange-600/90 hover:bg-orange-600 text-white"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                <span className="flex items-center gap-3">
                  <UserCog size={18} className={pendingRoleApprovals > 0 ? "" : "opacity-40"} />
                  {t("roleApprovalsNav")}
                </span>
                {pendingRoleApprovals > 0 ? (
                  <span className="min-w-[1.5rem] rounded-lg bg-white/20 px-2 py-0.5 text-center text-[10px] font-black">
                    {pendingRoleApprovals}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/admin/disputes"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center gap-3"
              >
                <Scale size={18} className="opacity-40" />
                {t("disputesNav")}
              </Link>
              <Link
                href="/admin/messages"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center gap-3"
              >
                <MessageSquare size={18} className="opacity-40" />
                {t("messagesTitle")}
              </Link>
              <Link
                href="/admin/analytics"
                className="w-full min-h-[3rem] px-5 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all text-left flex items-center gap-3"
              >
                <BarChart3 size={18} className="opacity-40" />
                {t("analyticsNav")}
              </Link>
            </div>
          </div>
          <div className="pt-8 mt-8 border-t border-white/10 flex items-center justify-between">
            <span className="id-eyebrow opacity-40">
              {t("versionLabel")}
            </span>
            <div className="p-2 bg-orange-600 rounded-lg shadow-lg shadow-orange-900/40">
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
      className="bg-white rounded-4xl p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all"
    >
      <div className="flex items-center gap-4 text-gray-400 mb-6">
        <div
          className={`p-4 rounded-2xl ${isOrange ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-900"}`}
        >
          {icon}
        </div>
        <span className="id-eyebrow leading-none">
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
