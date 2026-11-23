import { formatDateTimeInZone } from "@/lib/format-datetime";
import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPlatformSettingsForAdmin } from "@/services/PlatformSettingsService";
import AdminPlatformSettingsClient from "@/components/admin/AdminPlatformSettingsClient";
import { getAppLinkStats } from "@/services/AppLinkService";

export default async function AdminPlatformSettingsPage({
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

  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  const [{ values, updatedAt }, appLinkStats] = await Promise.all([
    getPlatformSettingsForAdmin(),
    getAppLinkStats(30),
  ]);
  const { platformHolidayDates, minAppVersion, latestAppVersion, ...rest } = values;
  const base = {
    ...rest,
    holidayDatesRaw: platformHolidayDates.join("\n"),
    minAppVersion: minAppVersion ?? "",
    latestAppVersion: latestAppVersion ?? "",
  };

  const updatedAtLabel = updatedAt
    ? formatDateTimeInZone(updatedAt, {
        locale: locale === "en" ? "en-GB" : "tr-TR",
        timeZone: PLATFORM_TIMEZONE,
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-10 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            aria-label={tCommon("back")}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            {t("platformSettingsTitle")}
          </h1>
        </div>
      </header>

      <div className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-8">
        <p className="text-sm text-gray-600 max-w-2xl">{t("platformSettingsIntro")}</p>
        <AdminPlatformSettingsClient
          initial={base}
          updatedAtLabel={updatedAtLabel}
        />

        <section className="rounded-2xl border border-gray-100 bg-white p-6" aria-labelledby="app-link-stats">
          <h2 id="app-link-stats" className="id-display text-lg text-gray-900 mb-4">
            {t("appLinkStatsTitle")}
          </h2>
          {appLinkStats.length === 0 ? (
            <p className="text-sm text-gray-500">{t("appLinkStatsEmpty")}</p>
          ) : (
            <table className="w-full text-sm" data-testid="app-link-stats">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">{t("appLinkStatsSource")}</th>
                  <th className="py-2 pr-4">{t("appLinkStatsPlatform")}</th>
                  <th className="py-2 pr-4">{t("appLinkStatsOutcome")}</th>
                  <th className="py-2 text-right">{t("appLinkStatsCount")}</th>
                </tr>
              </thead>
              <tbody>
                {appLinkStats.map((r) => (
                  <tr key={`${r.source}|${r.platform}|${r.outcome}`} className="border-t border-gray-100">
                    <td className="py-2 pr-4 font-mono">{r.source}</td>
                    <td className="py-2 pr-4">{r.platform}</td>
                    <td className="py-2 pr-4">{r.outcome}</td>
                    <td className="py-2 text-right font-bold">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
