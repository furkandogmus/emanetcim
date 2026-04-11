import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";
import { Building2, Users } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MarketingHotels" });
  return { title: t("metaTitle") };
}

export default async function HotelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MarketingHotels");

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100 bg-blue-50/40 px-6 py-20 text-center">
        <h1 className="text-4xl font-black tracking-tight md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          {t("heroSubtitle")}
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <Users className="text-blue-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b1Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b1Body")}</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <Building2 className="text-blue-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b2Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b2Body")}</p>
          </div>
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/contact"
            className="inline-flex rounded-2xl bg-blue-600 px-10 py-4 text-sm font-black uppercase tracking-wider text-white hover:bg-blue-700"
          >
            {t("cta")}
          </Link>
        </div>
      </main>
    </div>
  );
}
