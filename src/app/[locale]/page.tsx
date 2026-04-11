import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search, MapPin, ShieldCheck, Clock, Star } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getGuestLandingStats } from "@/lib/guest-landing-stats";
import { getHomeTestimonials } from "@/lib/home-testimonials";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import TestimonialCarousel from "@/components/guest/TestimonialCarousel";
import ComparisonTable from "@/components/guest/ComparisonTable";
import BagProtection from "@/components/guest/BagProtection";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = getSiteBaseUrl();
  return {
    alternates: alternatesForPath(locale, ""),
    openGraph: { url: `${base}/${locale}` },
  };
}

/**
 * Guest Landing Page - Turist Karşılama Sayfası
 * Minimalist, güven veren ve hızlı aksiyon odaklı tasarım.
 */
export default async function GuestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Guest");
  const common = await getTranslations("Common");
  const tCity = await getTranslations("CityStorage");
  const [stats, testimonials] = await Promise.all([
    getGuestLandingStats(),
    getHomeTestimonials(14),
  ]);
  const nfLocale: Record<string, string> = {
    tr: "tr-TR",
    en: "en-US",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
  };
  const nf = new Intl.NumberFormat(nfLocale[locale] ?? "en-US");

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      {/* Hero Section */}
      <header className="relative pt-32 pb-20 px-6 flex flex-col items-center text-center bg-gray-50 overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-gray-900 mb-6 leading-[1.1]">
            {t('heroTitle')}
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-md mx-auto">
            {t('heroSubtitle')}
          </p>

          {/* Minimalist Search Bar UI */}
          <Link 
            href="/search"
            className="w-full max-w-lg mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-2 flex items-center gap-3 hover:border-orange-200 transition-all group"
          >
            <div className="bg-orange-50 p-3 rounded-xl text-orange-600 group-hover:bg-orange-100 transition-colors">
              <Search size={24} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{common('search')}</p>
              <p className="text-gray-400 font-medium">{t('searchPlaceholder')}</p>
            </div>
            <div className="bg-orange-600 text-white px-5 py-3 rounded-xl font-bold hidden sm:block">
              {t('findShops')}
            </div>
          </Link>
        </div>
      </header>

      {/* Live trust metrics */}
      <section
        className="border-y border-gray-100 bg-white py-10 px-6"
        aria-label={t("trustStatsAria")}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 text-center">
          <div>
            <p className="text-2xl md:text-3xl font-black tabular-nums text-gray-900">
              {nf.format(stats.activeLocations)}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t("trustStatLocations")}
            </p>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black tabular-nums text-gray-900">
              {nf.format(stats.completedStays)}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t("trustStatStays")}
            </p>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black tabular-nums text-gray-900">
              {nf.format(stats.reviewCount)}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t("trustStatReviews")}
            </p>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black tabular-nums text-gray-900 inline-flex items-center gap-1">
              {stats.averageRating != null && stats.reviewCount > 0 ? (
                <>
                  {stats.averageRating.toFixed(1)}
                  <Star
                    className="inline h-7 w-7 md:h-8 md:w-8 text-orange-500 fill-orange-500"
                    aria-hidden
                  />
                </>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t("trustStatAvgRating")}
            </p>
          </div>
        </div>
      </section>

      <section
        className="border-y border-gray-100 bg-gray-50/90 py-14 px-6"
        aria-labelledby="city-hub-heading"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="city-hub-heading"
            className="text-center text-xs font-black uppercase tracking-[0.2em] text-gray-400"
          >
            {t("cityHubTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-gray-500">
            {t("cityHubIntro")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2 md:gap-3">
            {STORAGE_CITIES.map((c) => (
              <Link
                key={c.slug}
                href={`/luggage-storage/${c.slug}`}
                className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 shadow-sm transition hover:border-orange-200 hover:text-orange-600"
              >
                {tCity(`${c.slug}.label`)}
              </Link>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link
              href="/luggage-storage"
              className="text-sm font-black uppercase tracking-widest text-orange-600 underline-offset-4 hover:underline"
            >
              {t("cityHubViewAll")}
            </Link>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 pb-4">
        <BagProtection variant="landing" />
      </div>

      {/* Trust Features - Minimalist Icons */}
      <section className="py-20 px-6 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-12 text-center text-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">{t('insuranceIncluded')}</h4>
            <p className="text-gray-500 leading-relaxed">{t('trustInsuranceBody')}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <MapPin size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">{t('trustNetworkTitle')}</h4>
            <p className="text-gray-500 leading-relaxed">{t('trustNetworkBody')}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <Clock size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">{t('trustSupportTitle')}</h4>
            <p className="text-gray-500 leading-relaxed">{t('trustSupportBody')}</p>
          </div>
        </div>
      </section>

      <TestimonialCarousel items={testimonials} />
      <ComparisonTable />
    </div>
  );
}

