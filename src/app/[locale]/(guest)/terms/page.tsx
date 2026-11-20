import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { Gavel } from "lucide-react";
import { Link } from "@/i18n/routing";
import { socialMetadata } from "@/lib/social-metadata";
import { getPaymentCopyMode } from "@/lib/payment-copy";
import { TERMS_COPY, termsLanguageFor, termsSections } from "@/lib/legal/terms-content";
import { getLegalEntity, legalEntityDisplay } from "@/lib/legal/entity";

/**
 * Metin `src/lib/legal/terms-content.ts`te: Turkce baglayici, diger diller Ingilizce
 * kolaylik cevirisini (ustte "Turkce metin gecerlidir" notuyla) gorur.
 */

// Taraf tanimi (1.1) `legal/entity.ts`ten gelir; unvan yoksa uretimde paragraf cizilmez.
const COMPANY_LEGAL_NAME = legalEntityDisplay(getLegalEntity(), "legalName") ?? "";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "terms");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/terms"),
    ...socialMetadata({
      url: `${base}/${locale}/terms`,
      title,
      description,
    }),
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Terms");
  const language = termsLanguageFor(locale);
  const copy = TERMS_COPY[language];
  // Para cumlelerinin surumunu aktif odeme saglayicisi secer -- `payment-copy.ts`.
  const sections = termsSections(language, {
    companyLegalName: COMPANY_LEGAL_NAME,
    paymentMode: getPaymentCopyMode(),
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="py-24 px-6 bg-orange-600 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-orange-700 to-orange-500" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-8 border border-white/20">
            <Gavel size={32} />
          </div>
          <h1 lang={language} className="text-5xl font-black tracking-tighter mb-4">
            {copy.title}
          </h1>
          <p className="text-orange-100 font-bold text-lg">
            {t("lastUpdated")}
          </p>
        </div>
      </header>

      <div lang={language} className="max-w-4xl mx-auto py-16 px-6">
        {copy.notice ? (
          <p className="mb-12 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-600">
            {copy.notice}
          </p>
        ) : null}
        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-black text-gray-900 mb-4 border-l-4 border-orange-600 pl-4">
                {section.title}
              </h2>
              <div className="space-y-4 text-gray-700 font-medium leading-relaxed">
                {section.paragraphs.map((p, i) =>
                  Array.isArray(p) ? (
                    <ul key={i} className="list-disc pl-6 space-y-2">
                      {p.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{p}</p>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-20 pt-10 border-t border-gray-100 text-center">
          <p className="text-gray-400 font-bold text-sm">
            {t("footerQuestion")}{" "}
            <Link href="/contact" className="text-orange-600 hover:underline">
              {t("footerContact")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
