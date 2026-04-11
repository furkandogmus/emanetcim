import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";
import { TrendingUp, LayoutDashboard, MapPin } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MarketingBecomePartner" });
  return { title: t("metaTitle") };
}

export default async function BecomePartnerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MarketingBecomePartner");

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100 bg-orange-50/40 px-6 py-20 text-center">
        <h1 className="text-4xl font-black tracking-tight md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          {t("heroSubtitle")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/partners"
            className="rounded-2xl bg-orange-600 px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-orange-600/25 hover:bg-orange-700"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href="/partners"
            className="rounded-2xl border border-gray-200 bg-white px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-800 hover:border-orange-200"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <TrendingUp className="text-orange-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b1Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b1Body")}</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <LayoutDashboard className="text-orange-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b2Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b2Body")}</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <MapPin className="text-orange-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b3Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b3Body")}</p>
          </div>
        </div>

        <section className="mt-16 rounded-[2rem] border border-orange-100 bg-orange-50/50 p-10 text-center">
          <h2 className="text-xl font-black">{t("calcTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
            {t("calcBody")}
          </p>
        </section>
      </main>
    </div>
  );
}
