import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { Gavel, Scale } from "lucide-react";
import { Link } from "@/i18n/routing";

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
    openGraph: { title, description, url: `${base}/${locale}/terms` },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Terms");

  return (
    <div className="min-h-screen bg-white">
      <header className="py-24 px-6 bg-orange-600 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-orange-700 to-orange-500" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-8 border border-white/20">
            <Gavel size={32} />
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-4">
            {t("title")}
          </h1>
          <p className="text-orange-100 font-bold text-lg">
            {t("lastUpdated")}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-24 px-6">
        <div className="prose prose-orange max-w-none">
          <div className="flex items-start gap-4 p-8 bg-gray-50 rounded-3xl border border-gray-100 mb-16">
            <Scale className="text-gray-400 shrink-0" size={24} />
            <p className="text-gray-500 text-sm font-bold leading-relaxed m-0 italic">
              &quot;{t("intro")}&quot;
            </p>
          </div>

          <div className="space-y-20">
            {[1, 2, 3, 4, 5, 6].map((idx) => {
              const qKey = `q${idx}`;
              const aKey = `a${idx}`;
              return (
                <section key={idx}>
                  <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-baseline gap-4">
                    <span className="text-4xl font-black text-orange-600/20">
                      {idx}
                    </span>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(qKey as any)}
                  </h2>
                  <div className="text-gray-500 font-medium leading-relaxed bg-gray-50/30 p-10 rounded-[3rem] border border-gray-100">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(aKey as any)}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="mt-24 pt-12 border-t border-gray-100 text-center">
          <p className="text-gray-400 font-bold text-sm">
            {t("footerQuestion")}{" "}
            <Link href="/contact" className="text-orange-600 hover:underline">
              {t("footerContact")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
