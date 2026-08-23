import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Users,
  Eye,
  Search,
  Store,
  ShoppingCart,
  Briefcase,
  UserPlus,
} from "lucide-react";
import { analyticsService } from "@/services/AnalyticsService";

const RANGE_DAYS = 30;

export default async function AdminAnalyticsPage({
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

  const t = await getTranslations("AdminAnalytics");
  const summary = await analyticsService.getDashboardSummary(RANGE_DAYS);

  const cards = [
    { title: t("uniqueSessions"), value: summary.uniqueSessions, icon: <Users size={22} /> },
    { title: t("pageViews"), value: summary.pageViews, icon: <Eye size={22} /> },
    { title: t("searches"), value: summary.searches, icon: <Search size={22} /> },
    { title: t("shopViews"), value: summary.shopViews, icon: <Store size={22} /> },
    { title: t("checkoutsStarted"), value: summary.checkoutsStarted, icon: <ShoppingCart size={22} /> },
    { title: t("bookingsCreated"), value: summary.bookingsCreated, icon: <Briefcase size={22} />, isOrange: true },
    { title: t("newUsers"), value: summary.newUsers, icon: <UserPlus size={22} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-24 font-sans sm:px-6 lg:p-10 lg:pt-32">
      <header className="mb-8 lg:mb-12">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 mb-2 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
          {t("subtitle", { days: RANGE_DAYS })}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 mb-10">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
          >
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                c.isOrange ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-900"
              }`}
            >
              {c.icon}
            </div>
            <p
              className={`text-3xl font-black tracking-tight ${
                c.isOrange ? "text-orange-600" : "text-gray-900"
              }`}
            >
              {c.value.toLocaleString(locale)}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              {c.title}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-gray-400">
            {t("topPagesTitle")}
          </h3>
          {summary.topPaths.length === 0 ? (
            <p className="text-xs font-bold text-gray-400">{t("noData")}</p>
          ) : (
            <ul className="space-y-3">
              {summary.topPaths.map((p) => (
                <li
                  key={p.path}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3"
                >
                  <span className="truncate text-sm font-bold text-gray-800">{p.path}</span>
                  <span className="shrink-0 text-xs font-black text-gray-400">
                    {p.count.toLocaleString(locale)} {t("viewsSuffix")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-gray-400">
            {t("topShopsTitle")}
          </h3>
          {summary.topShops.length === 0 ? (
            <p className="text-xs font-bold text-gray-400">{t("noData")}</p>
          ) : (
            <ul className="space-y-3">
              {summary.topShops.map((s) => (
                <li
                  key={s.shopId}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3"
                >
                  <span className="truncate text-sm font-bold text-gray-800">{s.name}</span>
                  <span className="shrink-0 text-xs font-black text-gray-400">
                    {s.count.toLocaleString(locale)} {t("viewsSuffix")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-8 text-xs font-bold text-gray-400">{t("consentNote")}</p>
    </div>
  );
}
