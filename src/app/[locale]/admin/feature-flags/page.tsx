import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import AdminFeatureFlagsClient from "@/components/admin/AdminFeatureFlagsClient";
import { paymentService } from "@/services/PaymentService";

function allowListToLines(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join("\n");
}

export default async function AdminFeatureFlagsPage({
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

  const rows = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });

  /*
    ETKIN durum, bayragin kendisi DEGIL.

    NEDEN: ortam degiskeni bayragi eziyor. Admin `payments` bayragini "acik"
    gorup odemenin aslinda kapali oldugunu anlayamazdi -- ekran dogru veriyi
    gosterip yanlis sonuc dusundururdu. Bu sayfanin bastaki hatasi da tam olarak
    buydu: metin var olmayan bir anahtardan bahsediyordu.
  */
  const acceptingPayments = await paymentService.isAcceptingNewPayments();
  const envForcedOff = process.env.PAYMENTS_ENABLED?.trim() === "false";

  const flags = rows.map((r) => ({
    id: r.id,
    key: r.key,
    enabled: r.enabled,
    rolloutPct: r.rolloutPct,
    allowedUserIdsLines: allowListToLines(r.allowedUserIds),
    description: r.description ?? "",
    updatedAtLabel: r.updatedAt.toLocaleString(
      locale === "en" ? "en-GB" : "tr-TR",
    ),
  }));

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
            {t("featureFlagsTitle")}
          </h1>
        </div>
      </header>

      <main className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-8">
        <div
          className={`rounded-lg border p-4 text-sm font-bold ${
            acceptingPayments
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <p>
            {acceptingPayments
              ? t("paymentsStateOn")
              : t("paymentsStateOff")}
          </p>
          {envForcedOff && (
            <p className="mt-2 font-normal">{t("paymentsStateEnvOff")}</p>
          )}
        </div>

        <p className="text-sm text-gray-600 max-w-2xl">
          {t("featureFlagsIntro")}
        </p>
        {flags.length === 0 ? (
          <p className="text-sm font-bold text-gray-500">{t("featureFlagsEmpty")}</p>
        ) : (
          <AdminFeatureFlagsClient initial={flags} />
        )}
      </main>
    </div>
  );
}
