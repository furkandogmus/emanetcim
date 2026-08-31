import { getTranslations, setRequestLocale } from "next-intl/server";
import { Heart, Target, Rocket, Users, ShieldCheck, Zap } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { socialMetadata } from "@/lib/social-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "about");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/about"),
    ...socialMetadata({
      url: `${base}/${locale}/about`,
      title,
      description,
    }),
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-orange-50/50 -skew-x-12 translate-x-32" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full text-orange-600 text-xs id-eyebrow mb-6">
              <Heart size={14} />
              {t("badge")}
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tighter mb-8 leading-[0.9]">
              {t("title")}
            </h1>
            <p className="text-xl text-gray-400 font-bold leading-relaxed">
              {t("intro")}
            </p>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="p-12 bg-white rounded-4xl border border-gray-100 shadow-sm">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-8">
              <Target size={28} />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{t("vision")}</h2>
            <p className="text-gray-500 font-medium leading-relaxed">
              {t("visionBody")}
            </p>
          </div>
          <div className="p-12 bg-white rounded-4xl border border-gray-100 shadow-sm">
            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-8">
              <Rocket size={28} />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{t("mission")}</h2>
            <p className="text-gray-500 font-medium leading-relaxed">
              {t("missionBody")}
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-xs font-black text-orange-600 uppercase tracking-[0.3em] mb-4">
              {t("whyUs")}
            </h2>
            <p className="text-4xl font-black text-gray-900 tracking-tighter">
              {t("ourValues")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((idx) => {
              const Icons = [Users, ShieldCheck, Zap];
              const Icon = Icons[idx - 1];
              const titleKey = `value${idx}Title`;
              const descKey = `value${idx}Desc`;
              return (
                <div key={idx} className="group p-10 rounded-4xl bg-white hover:bg-orange-600 transition-all duration-500 border border-gray-100 hover:border-orange-600">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 mb-6 group-hover:bg-white/20 group-hover:text-white transition-colors">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3 group-hover:text-white transition-colors">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(titleKey as any)}
                  </h3>
                  <p className="text-gray-400 font-bold text-sm group-hover:text-white/80 transition-colors">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(descKey as any)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-32 px-6">
        <div className="max-w-7xl mx-auto bg-gray-900 rounded-4xl p-12 md:p-24 text-center overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-transparent pointer-events-none" />
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-8 relative z-10">
            {t("ctaTitle")}
          </h2>
          <Link href="/search" className="inline-flex h-16 items-center px-12 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-lg transition-all active:scale-95 relative z-10 shadow-xl shadow-orange-900/40">
            {t("ctaButton")}
          </Link>
        </div>
      </section>
    </div>
  );
}
