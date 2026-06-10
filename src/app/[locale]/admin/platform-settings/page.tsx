import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import AdminPlatformSettingsClient from "@/components/admin/AdminPlatformSettingsClient";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";
import { parsePlatformHolidayDates } from "@/lib/booking-holidays";

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

  const row = await prisma.platformSettings.findUnique({
    where: { id: "default" },
  });

  const base = row
    ? {
        maxStayDays: row.maxStayDays,
        maxBagsPerSlot: row.maxBagsPerSlot,
        insuranceFeeTry: moneyToNumber(row.insuranceFeeTry),
        earlyRefundRatio: moneyToNumber(row.earlyRefundRatio),
        cancelFixedFeeTry: moneyToNumber(row.cancelFixedFeeTry),
        defaultShopCapacity: row.defaultShopCapacity,
        defaultPricePerDay: moneyToNumber(row.defaultPricePerDay),
        bagMultiplierS: moneyToNumber(row.bagMultiplierS),
        bagMultiplierM: moneyToNumber(row.bagMultiplierM),
        bagMultiplierXl: moneyToNumber(row.bagMultiplierXl),
        holidayDatesRaw: parsePlatformHolidayDates(row.platformHolidayDates).join(
          "\n",
        ),
      }
    : {
        maxStayDays: DEFAULT_PRICING_RULES.maxStayDays,
        maxBagsPerSlot: DEFAULT_PRICING_RULES.maxBagsPerSlot,
        insuranceFeeTry: DEFAULT_PRICING_RULES.insuranceFeeTry,
        earlyRefundRatio: DEFAULT_PRICING_RULES.earlyRefundRatio,
        cancelFixedFeeTry: DEFAULT_PRICING_RULES.cancelFixedFeeTry,
        defaultShopCapacity: DEFAULT_PRICING_RULES.defaultShopCapacity,
        defaultPricePerDay: DEFAULT_PRICING_RULES.defaultPricePerDay,
        bagMultiplierS: DEFAULT_PRICING_RULES.bagMultipliers.S,
        bagMultiplierM: DEFAULT_PRICING_RULES.bagMultipliers.M,
        bagMultiplierXl: DEFAULT_PRICING_RULES.bagMultipliers.XL,
        holidayDatesRaw: "",
      };

  const updatedAtLabel = row?.updatedAt
    ? row.updatedAt.toLocaleString(locale === "en" ? "en-GB" : "tr-TR")
    : "—";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-10 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            {t("platformSettingsTitle")}
          </h1>
        </div>
      </header>

      <main className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-8">
        <p className="text-sm text-gray-600 max-w-2xl">{t("platformSettingsIntro")}</p>
        <AdminPlatformSettingsClient
          initial={base}
          updatedAtLabel={updatedAtLabel}
        />
      </main>
    </div>
  );
}
