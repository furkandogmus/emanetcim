import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldAlert, Fingerprint } from "lucide-react";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { socialMetadata } from "@/lib/social-metadata";
import {
  getLegalEntity,
  legalEntityDisplay,
  LEGAL_ENTITY_ROWS,
  type LegalEntityField,
} from "@/lib/legal/entity";

const ENTITY_LABEL_KEYS: Record<LegalEntityField, string> = {
  legalName: "entityLabelLegalName",
  mersisNo: "entityLabelMersisNo",
  address: "entityLabelAddress",
  taxOffice: "entityLabelTaxOffice",
  taxNumber: "entityLabelTaxNumber",
  kep: "entityLabelKep",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "kvkk");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/kvkk"),
    ...socialMetadata({
      url: `${base}/${locale}/kvkk`,
      title,
      description,
    }),
  };
}

export default async function KvkkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("KVKK");
  const entity = getLegalEntity();
  const entityRows = LEGAL_ENTITY_ROWS.flatMap((field) => {
    const value = legalEntityDisplay(entity, field);
    return value ? [{ field, value }] : [];
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="py-24 px-6 bg-gray-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg text-orange-400 id-eyebrow mb-6 border border-white/10">
            <Fingerprint size={14} />
            {t("badge")}
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-4">{t("title")}</h1>
          <p className="text-gray-400 font-bold text-lg">{t("lastUpdated")}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-24 px-6">
        <div className="prose prose-orange max-w-none">
          <div className="flex items-start gap-6 p-8 bg-orange-50 rounded-3xl border border-orange-100 mb-12">
            <ShieldAlert className="text-orange-600 shrink-0 mt-1" size={24} />
            <p className="text-orange-900 text-sm font-bold leading-relaxed m-0">
              {t("importantSummary")}
            </p>
          </div>

          <div className="space-y-16">
            {[1, 2, 3, 4, 5].map((idx) => {
              const qKey = `q${idx}`;
              const aKey = `a${idx}`;
              return (
                <section key={idx}>
                  <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-4">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-sm font-black">
                      {idx}
                    </span>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(qKey as any)}
                  </h2>
                  <div className="text-gray-500 font-medium leading-relaxed bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
                    {idx === 1 ? (
                      // Veri sorumlusu kunyeden gelir; tescilli olmayan unvan yazilmaz.
                      <dl className="m-0 grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
                        <dt className="font-semibold text-gray-900">{t("entityLabelTradeName")}</dt>
                        <dd className="m-0">{entity.tradeName}</dd>
                        {entityRows.map(({ field, value }) => (
                          <div key={field} className="contents">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <dt className="font-semibold text-gray-900">{t(ENTITY_LABEL_KEYS[field] as any)}</dt>
                            <dd className="m-0">{value}</dd>
                          </div>
                        ))}
                        <dt className="font-semibold text-gray-900">{t("entityLabelEmail")}</dt>
                        <dd className="m-0">{entity.dataRequestEmail}</dd>
                      </dl>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      t(aKey as any, { email: entity.dataRequestEmail })
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-20 p-12 bg-gray-900 rounded-4xl text-center text-white">
            <h3 className="text-xl font-black mb-4">{t("contactTitle")}</h3>
            <p className="text-gray-400 font-bold mb-8">{t("contactBody")}</p>
            <a href={`mailto:${entity.dataRequestEmail}`} className="inline-flex h-14 items-center px-10 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl id-eyebrow text-sm transition-all shadow-xl shadow-orange-900/20">
              {entity.dataRequestEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
