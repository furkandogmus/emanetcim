import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/routing";
import { buildFaqPageJsonLd } from "@/lib/faq-json-ld";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "faq");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/faq"),
    openGraph: { title, description, url: `${base}/${locale}/faq` },
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("FAQ");

  const guestFaqIds = [1, 2, 3, 4, 5, 6, 7, 8] as const;
  const faqItems = guestFaqIds.map((idx) => ({
    question: t(`q${idx}` as "q1"),
    answer: t(`a${idx}` as "a1"),
  }));
  const faqJsonLd = buildFaqPageJsonLd(faqItems);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <header className="py-24 px-6 bg-white border-b border-gray-100 text-center">
        <h1 className="text-5xl font-black text-gray-900 tracking-tighter mb-4">
          {t("title")}
        </h1>
        <p className="text-gray-400 font-bold text-lg max-w-xl mx-auto">
          {t("subtitle")}
        </p>
      </header>

      <main className="max-w-4xl mx-auto py-20 px-6">
        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <section>
            <h2 className="text-xs font-black text-orange-600 uppercase tracking-[0.3em] mb-8">
              {t("guestTitle")}
            </h2>
            <div className="flex flex-col gap-4">
              {guestFaqIds.map((idx) => {
                const qKey = `q${idx}`;
                const aKey = `a${idx}`;
                return (
                  <details key={idx} className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                    <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                      <span className="font-bold text-gray-900 group-open:text-orange-600 transition-colors pr-4">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {t(qKey as any)}
                      </span>
                      <ChevronRight size={18} className="text-gray-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="px-6 pb-6 text-sm text-gray-500 font-medium leading-relaxed">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {t(aKey as any)}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-8">
              {t("partnerTitle")}
            </h2>
            <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900">{t("partnerPitchTitle")}</h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed px-4">
                {t("partnerPitchBody")}
              </p>
              <Link href="/partners" className="h-12 flex items-center px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-200">
                {t("partnerPitchCta")}
              </Link>
            </div>
          </section>
        </div>

        {/* Support CTA */}
        <section className="bg-gray-900 rounded-[3rem] p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 blur-[100px] rounded-full" />
          <h2 className="text-3xl font-black mb-2">{t("ctaTitle")}</h2>
          <p className="text-gray-400 font-medium mb-8">
            {t("ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact" className="h-14 flex items-center px-10 bg-white text-gray-900 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all">
              {t("ctaButton")}
            </Link>
            <a href="https://wa.me/905422415597" target="_blank" rel="noopener noreferrer" className="h-14 flex items-center px-10 bg-green-500/10 text-green-500 border border-green-500/30 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-green-500 hover:text-white transition-all">
              WHATSAPP DESTEK
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
