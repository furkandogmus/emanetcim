import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { MapPin, Store } from "lucide-react";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";

/**
 * Talep haritası — ESNAFA yönelik pazarlama sayfası.
 *
 * NE SATIYOR: "şu semtte X kişi emanet noktası aradı" cümlesi, bir dükkan
 * sahibi için soyut bir vaatten farklı bir şeydir — kendi semtindeki ölçülmüş
 * talebi görüyor. Talep testi noktalarının asıl işi buydu zaten; bu sayfa o
 * ölçümü partner kazanımına çeviriyor.
 *
 * DÜRÜSTLÜK SINIRI: yalnızca SİNYAL ALMIŞ noktalar listelenir. 482 noktanın
 * hepsini basmak "talep var" diyen bir sayfayı sıfır listesine çevirirdi ve
 * esnafa gösterilen rakam, onun dükkan açmasına gerekçe olacak rakamdır.
 * Sinyal yoksa sayfa bunu SÖYLER (`emptyTitle`) — uydurma bir sayı yazmaz.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MarketingDemand" });
  const base = getSiteBaseUrl();
  return {
    title: t("metaTitle"),
    description: t("heroSubtitle"),
    alternates: alternatesForPath(locale, "/demand"),
    openGraph: {
      title: t("metaTitle"),
      description: t("heroSubtitle"),
      url: `${base}/${locale}/demand`,
      type: "website",
    },
  };
}

export default async function DemandPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MarketingDemand");
  const rows = await prelaunchInterestService.topDemand(30).catch(() => []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100 px-6 py-16 text-center">
        <h1 className="text-3xl id-display tracking-tight md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
          {t("heroSubtitle")}
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12 flex flex-col gap-12">
        <section className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <div className="id-surface border border-gray-100 bg-gray-50 p-8 text-center">
              <h2 className="text-lg id-display">{t("emptyTitle")}</h2>
              <p className="mt-2 text-sm text-gray-600">{t("emptyBody")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="py-2 text-xs id-eyebrow">{t("tablePoint")}</th>
                    <th className="py-2 text-right text-xs id-eyebrow">
                      {t("tableWants")}
                    </th>
                    <th className="py-2 text-right text-xs id-eyebrow">
                      {t("tableEmails")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.shopId} className="border-t border-gray-100">
                      <td className="py-3">
                        <Link
                          href={`/shop/${r.shopId}`}
                          className="font-bold hover:underline"
                        >
                          {r.shopName}
                        </Link>
                        <span className="text-gray-500">
                          {" "}
                          · {r.city ?? "—"}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {r.wantCount}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {r.interestCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-lg id-display">
            <MapPin size={18} className="id-accent" />
            {t("howTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">{t("howBody")}</p>
        </section>

        <section className="id-surface border border-gray-100 bg-gray-50 p-8 flex flex-col items-start gap-3">
          <h2 className="flex items-center gap-2 text-lg id-display">
            <Store size={18} className="id-accent" />
            {t("ctaTitle")}
          </h2>
          <p className="text-sm text-gray-600">{t("ctaBody")}</p>
          <Link href="/become-partner" className="btn-ui btn-ui-lg btn-ui-primary">
            {t("ctaButton")}
          </Link>
        </section>
      </div>
    </div>
  );
}
