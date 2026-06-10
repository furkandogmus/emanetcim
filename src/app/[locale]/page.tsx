import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search, MapPin, ShieldCheck, Clock, Star } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getGuestLandingStats } from "@/lib/guest-landing-stats";
import { getHomeTestimonials } from "@/lib/home-testimonials";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import TestimonialCarousel from "@/components/guest/TestimonialCarousel";
import ComparisonTable from "@/components/guest/ComparisonTable";
import BagProtection from "@/components/guest/BagProtection";
import PartnerPromoModal from "@/components/partner/PartnerPromoModal";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";
import { buildItemListJsonLd, buildWebPageJsonLd } from "@/lib/page-json-ld";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = getSiteBaseUrl();
  const t = await getTranslations({ locale, namespace: "Guest" });
  const title = locale === "tr" ? "Bagaj Emanet ve Valiz Depolama" : "Luggage Storage and Bag Drop";
  const description = t("heroSubtitle");
  return {
    title,
    description,
    alternates: alternatesForPath(locale, ""),
    openGraph: {
      url: `${base}/${locale}`,
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
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
  const msg = (key: string, fallback: string) => {
    const tx = t as unknown as { has?: (k: string) => boolean };
    if (typeof tx.has === "function" && tx.has(key)) return t(key as never);
    return fallback;
  };
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
  const faqItems = [
    {
      question: msg("homeFaq1Q", "How long does luggage storage booking take?"),
      answer: msg(
        "homeFaq1A",
        "After selecting your dates and bag count, you can typically complete booking in just a few minutes.",
      ),
    },
    {
      question: msg("homeFaq2Q", "How is luggage storage pricing calculated?"),
      answer: msg(
        "homeFaq2A",
        "Total price is based on bag count, duration, and platform rules, and is shown clearly during checkout.",
      ),
    },
    {
      question: msg("homeFaq3Q", "Which cities are available?"),
      answer: msg(
        "homeFaq3A",
        "You can browse active storage points from city pages including Istanbul, Ankara, Izmir, and other major destinations.",
      ),
    },
  ];
  const faqJsonLd = buildFaqJsonLd({
    locale,
    path: "",
    items: faqItems,
  });
  const webPageJsonLd = buildWebPageJsonLd({
    locale,
    path: "",
    title: locale === "tr" ? "Bagaj Emanet ve Valiz Depolama" : "Luggage Storage and Bag Drop",
    description: t("heroSubtitle"),
  });
  const cityItemListJsonLd = buildItemListJsonLd({
    locale,
    path: "",
    itemNamePrefix: t("cityHubTitle"),
    items: STORAGE_CITIES.map((city) => ({
      name: tCity(`${city.slug}.label`),
      urlPath: `/luggage-storage/${city.slug}`,
    })),
  });
  const editorialCopy =
    locale === "tr"
      ? {
          visualTitle: "Şehri Özgürce Yaşa",
          visualBody:
            "Uçuş öncesi, otel check-in beklerken veya günlük şehir turunda valiz taşımadan hareket edin.",
          visualCards: [
            {
              title: "Havalimanı ve terminal sonrası konfor",
              text: "Varıştan sonra en yakın noktaya bırak, günü valizsiz geçir.",
              image:
                "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80",
            },
            {
              title: "Tarihi bölgelerde kolay dolaşım",
              text: "Müze, çarşı ve merkez rotalarında ağırlık taşımadan gez.",
              image:
                "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
            },
            {
              title: "İş seyahatlerinde hızlı teslim-al",
              text: "Toplantı aralarında güvenli teslim, hızlı geri alma deneyimi.",
              image:
                "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
            },
          ],
          seoTitle: "Bagaj Emanet Hizmeti Hakkında",
          seoParagraphs: [
            "BagajPark, Türkiye genelinde yaygın emanet noktalarıyla valiz depolama sürecini dijitalleştirir. Kullanıcılar konuma göre en yakın noktaları görür, tarih aralığına uygun müsaitliği kontrol eder ve rezervasyonunu birkaç adımda tamamlar.",
            "Platform, güven sinyallerini görünür hale getirir: doğrulanmış partner noktaları, süreç kayıtları ve politika tabanlı koruma akışı. Bu yapı özellikle turistler, aktarma yolcuları ve otel check-in saatini bekleyen kullanıcılar için yüksek fayda sağlar.",
            "Luggage storage, bagaj emanet, valiz depolama ve şehir içi kısa süreli emanet gibi arama niyetlerine uygun olarak; sayfa yapısı hızlı keşif, net fiyat, güven ve mobil kullanılabilirlik ekseninde optimize edilmiştir.",
          ],
        }
      : {
          visualTitle: "Move Through the City, Hands-Free",
          visualBody:
            "Before check-in, after arrival, or during a full-day city walk, store your luggage and move freely.",
          visualCards: [
            {
              title: "Comfort right after airport transfer",
              text: "Drop your bags at a nearby point and start your day immediately.",
              image:
                "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80",
            },
            {
              title: "Easier sightseeing in dense city zones",
              text: "Explore museums and historic districts without carrying weight.",
              image:
                "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
            },
            {
              title: "Fast drop-off for business travelers",
              text: "Store safely between meetings and pick up when needed.",
              image:
                "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
            },
          ],
          seoTitle: "About Our Luggage Storage Experience",
          seoParagraphs: [
            "BagajPark digitizes luggage storage with verified local partner points across major Turkish cities. Guests can discover nearby locations, check date-based availability, and complete booking in minutes.",
            "The product is designed around trust and speed: visible partner verification, process records, and policy-based protection flows. This helps tourists, transfer passengers, and early-arrival guests stay mobile.",
            "For intent clusters such as luggage storage, baggage storage near me, and short-term bag drop, the page structure is optimized for discoverability, transparent pricing, and mobile-first conversion.",
          ],
        };

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityItemListJsonLd) }}
      />
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

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-gray-900 md:text-4xl">
            {editorialCopy.visualTitle}
          </h2>
          <p className="mt-3 text-base text-gray-500">{editorialCopy.visualBody}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {editorialCopy.visualCards.map((card) => (
            <article
              key={card.title}
              className="overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-sm"
            >
              <div
                className="h-44 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${card.image})` }}
                aria-hidden
              />
              <div className="p-4">
                <h3 className="text-sm font-black text-gray-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{card.text}</p>
              </div>
            </article>
          ))}
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

      <section className="mx-auto w-full max-w-4xl px-6 pb-16">
        <div className="rounded-[1.75rem] border border-gray-100 bg-white p-6 md:p-8">
          <h2 className="text-2xl font-black tracking-tight text-gray-900">
            {editorialCopy.seoTitle}
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600">
            {editorialCopy.seoParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <TestimonialCarousel items={testimonials} />
      <ComparisonTable />
      <PartnerPromoModal />
    </div>
  );
}

