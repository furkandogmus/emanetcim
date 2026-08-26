import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { Store, TrendingUp, Shield, Smartphone, ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "partners");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/partners"),
    openGraph: { title, description, url: `${base}/${locale}/partners` },
  };
}

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Partners");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-24 px-6 overflow-hidden bg-blue-600">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-500" />
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white text-xs id-eyebrow mb-8 border border-white/10">
            <Store size={14} />
            {t("heroBadge")}
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8 leading-none">
            {t("heroTitle")}
          </h1>
          <p className="text-xl text-blue-100 font-bold max-w-2xl mx-auto mb-10">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register?role=PARTNER" className="h-16 inline-flex items-center px-12 bg-white text-blue-600 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl shadow-blue-900/20">
              {t("heroCta")}
            </Link>
            <a href="https://wa.me/905422415597" target="_blank" rel="noopener noreferrer" className="h-16 inline-flex items-center px-10 bg-blue-500 text-white border border-blue-400/30 rounded-2xl id-eyebrow text-sm hover:bg-blue-400 transition-all">
              {t("contactUs")}
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[1, 2, 3].map((idx) => {
              const Icons = [TrendingUp, Shield, Smartphone];
              const Icon = Icons[idx - 1];
              const titleKey = `benefit${idx}Title`;
              const descKey = `benefit${idx}Desc`;
              return (
                <div key={idx} className="flex flex-col gap-6">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Icon size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(titleKey as any)}
                  </h3>
                  <p className="text-gray-500 font-bold leading-relaxed">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(descKey as any)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-20 text-center">
            {t("howItWorksTitle")}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((idx) => {
              const titleKey = `step${idx}Title`;
              const descKey = `step${idx}Desc`;
              return (
                <div key={idx} className="relative p-10 bg-white rounded-4xl border border-gray-100 shadow-sm">
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-200">
                    {idx}
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <h4 className="text-xl font-black text-gray-900 mb-4">{t(titleKey as any)}</h4>
                  <p className="text-sm text-gray-400 font-bold leading-relaxed">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(descKey as any)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-gray-900 rounded-4xl p-12 md:p-24 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/20 to-transparent" />
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-12 relative z-10">
            {t("ctaTitle")}
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
            <Link href="/register?role=PARTNER" className="h-16 w-full sm:w-auto inline-flex items-center px-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl shadow-blue-900/40">
              {t("ctaButton")}
              <ArrowRight className="ml-3" size={20} />
            </Link>
            <div className="flex items-center gap-3 px-6 py-4 bg-white/5 rounded-2xl border border-white/10">
              <MessageCircle size={20} className="text-blue-400" />
              <span className="text-sm id-eyebrow text-blue-100">{t("support247")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Link */}
      <section className="py-20 text-center">
        <p className="text-gray-400 font-bold mb-4">{t("moreQuestions")}</p>
        <Link href="/faq" className="text-blue-600 id-eyebrow hover:underline text-sm">
          {t("seeFaq")}
        </Link>
      </section>
    </div>
  );
}
