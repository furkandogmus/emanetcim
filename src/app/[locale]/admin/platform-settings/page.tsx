import { formatDateTimeInZone } from "@/lib/format-datetime";
import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPlatformSettingsForAdmin } from "@/services/PlatformSettingsService";
import AdminPlatformSettingsClient from "@/components/admin/AdminPlatformSettingsClient";

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

  const { values, updatedAt } = await getPlatformSettingsForAdmin();
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
      </div>
    </div>
  );
}
