import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Search } from "lucide-react";
import { getStorageCity, STORAGE_CITIES } from "@/lib/storage-cities";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { routing } from "@/i18n/routing";
import { buildCityStorageJsonLd } from "@/lib/city-storage-json-ld";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-json-ld";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";

export function generateStaticParams() {
  return STORAGE_CITIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const city = getStorageCity(slug);
  if (!city) return {};
  const t = await getTranslations({ locale, namespace: "CityStorage" });
  const base = getSiteBaseUrl();
  const canonical = `${base}/${locale}/luggage-storage/${slug}`;
  const title = t(`${slug}.metaTitle`);
  const description = t(`${slug}.metaDescription`);
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...routing.locales.map((loc) => [
          loc,
          `${base}/${loc}/luggage-storage/${slug}`,
        ] as const),
        [
          "x-default",
          `${base}/${routing.defaultLocale}/luggage-storage/${slug}`,
        ] as const,
      ]),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function CityLuggageStoragePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const city = getStorageCity(slug);
  if (!city) notFound();

  setRequestLocale(locale);
  const t = await getTranslations("CityStorage");
  const tCommon = await getTranslations("Common");
  const appName = tCommon("appName");
  const cityLabel = t(`${slug}.label`);
  const localeCopy = {
    whyTitle: t("detailWhyTitle", { city: cityLabel }),
    whyItems: [
      t("detailWhyItem1", { city: cityLabel }),
      t("detailWhyItem2"),
      t("detailWhyItem3"),
    ],
    howTitle: t("detailHowTitle"),
    howItems: [t("detailHowItem1"), t("detailHowItem2"), t("detailHowItem3")],
    faqTitle: t("detailFaqTitle", { city: cityLabel }),
    faqs: [
      {
        q: t("detailFaq1Question", { city: cityLabel }),
        a: t("detailFaq1Answer"),
      },
      { q: t("detailFaq2Question"), a: t("detailFaq2Answer") },
      { q: t("detailFaq3Question"), a: t("detailFaq3Answer") },
    ],
  };
  const faqJsonLd = buildFaqJsonLd({
    locale,
    path: `/luggage-storage/${slug}`,
    items: localeCopy.faqs.map((faq) => ({
      question: faq.q,
      answer: faq.a,
    })),
  });
  const q = encodeURIComponent(t(`${slug}.searchQuery`));
  const searchHref = `/search?q=${q}&lat=${city.lat}&lng=${city.lng}`;
  const cityData = t.raw(`${slug}`) as Record<string, unknown> | undefined;
  const sections = (cityData?.sections ?? []) as Array<{ title: string; body: string; keywords?: string }>;
  const tips = (cityData?.tips ?? []) as string[];
  const nearbyPlaces = (cityData?.nearbyPlaces ?? []) as string[];

  // JSON-LD for Article SEO
  const jsonLd = buildCityStorageJsonLd({
    locale,
    slug,
    pageName: t(`${slug}.headline`),
    description: t(`${slug}.metaDescription`),
    siteName: appName,
  });
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: tCommon("mobileNavHome"), path: `/${locale}` },
    {
      name: t(`${slug}.headline`),
      path: `/${locale}/luggage-storage/${slug}`,
    },
  ]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100 bg-gray-50/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link
            href="/"
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-orange-600"
          >
            ← {tCommon("back")}
          </Link>
        </div>
      </header>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">
          <MapPin size={14} aria-hidden />
          {appName}
        </p>
        <h1 className="text-3xl font-black tracking-tight text-gray-900 md:text-4xl">
          {t(`${slug}.headline`)}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-gray-600">
          {t(`${slug}.intro`)}
        </p>

        <Link
          href={searchHref}
          className="mt-10 inline-flex items-center gap-3 rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700"
        >
          <Search size={20} aria-hidden />
          {t(`${slug}.cta`)}
        </Link>

        <div className="mt-12 overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-sm">
          <div
            className="h-56 w-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${city.image})`,
            }}
            aria-hidden
          />
        </div>

        <section className="mt-12 rounded-[1.5rem] border border-gray-100 bg-gray-50 p-6">
          <h2 className="text-xl font-black text-gray-900">{localeCopy.whyTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            {localeCopy.whyItems.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-[1.5rem] border border-gray-100 bg-white p-6">
          <h2 className="text-xl font-black text-gray-900">{localeCopy.howTitle}</h2>
          <ol className="mt-4 space-y-2 text-sm text-gray-600">
            {localeCopy.howItems.map((item, idx) => (
              <li key={item}>
                {idx + 1}. {item}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 rounded-[1.5rem] border border-gray-100 bg-white p-6">
          <h2 className="text-xl font-black text-gray-900">{localeCopy.faqTitle}</h2>
          <div className="mt-4 space-y-4">
            {localeCopy.faqs.map((faq) => (
              <article key={faq.q} className="rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-black text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{faq.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* SEO Content Sections */}
        {sections.length > 0 && (
          <div className="mt-12 space-y-6">
            {sections.map((section, idx) => (
              <section key={idx} className="rounded-[1.5rem] border border-gray-100 bg-white p-6">
                <h2 className="text-lg font-black text-gray-900">{section.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{section.body}</p>
                {section.keywords && (
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-300">
                    #{section.keywords}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}

        {/* Tips Section */}
        {tips.length > 0 && (
          <section className="mt-6 rounded-[1.5rem] border border-orange-100 bg-orange-50 p-6">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="text-orange-600">★</span> {t("detailTipsTitle")}
            </h2>
            <ul className="mt-4 space-y-2">
              {tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-orange-600 mt-0.5">✓</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Nearby Places */}
        {nearbyPlaces.length > 0 && (
          <section className="mt-6 rounded-[1.5rem] border border-gray-100 bg-white p-6">
            <h2 className="text-lg font-black text-gray-900">
              {t("detailNearbyTitle")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {nearbyPlaces.map((place) => (
                <span key={place} className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                  {place}
                </span>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
