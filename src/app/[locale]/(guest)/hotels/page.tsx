import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { Building2, Users, Globe, Languages, ChevronDown } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MarketingHotels" });
  const base = getSiteBaseUrl();
  const title = t("metaTitle");
  const description = t("heroSubtitle");
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/hotels"),
    openGraph: {
      title,
      description,
      url: `${base}/${locale}/hotels`,
      type: "website",
    },
  };
}

export default async function HotelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MarketingHotels");

  // Log that this page is rendering
  console.log(`[HotelsPage] rendering for locale=${locale}`);

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
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <Globe className="text-blue-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b3Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b3Body")}</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <Languages className="text-blue-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b4Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b4Body")}</p>
          </div>
        </div>

        {/* FAQ Section */}
        <section className="mt-16">
          <h2 className="text-2xl font-black text-center mb-8">{t("faqTitle")}</h2>
          <div className="space-y-4">
            {/* Yapısal mesaj: t() string döner, dizi için t.raw() gerekir.
                Sabit index yerine map — locale'de daha az kayıt olsa çökmesin. */}
            {(t.raw("faqs") as { q: string; a: string }[]).map((faq, idx) => (
              <details key={idx} className="rounded-2xl border border-gray-100 p-4 group">
                <summary className="font-bold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  {faq.q}
                  <ChevronDown size={20} className="text-gray-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 bg-blue-50 p-10 rounded-[3rem] border border-blue-100 text-center">
          <h2 className="text-2xl font-black text-gray-900">{t("ctaTitle")}</h2>
          <p className="mt-3 text-gray-600 max-w-xl mx-auto">{t("ctaDescription")}</p>
          <div className="mt-8">
            <Link
              href="/contact"
              className="inline-flex rounded-2xl bg-blue-600 px-10 py-4 text-sm font-black uppercase tracking-wider text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              {t("cta")}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
