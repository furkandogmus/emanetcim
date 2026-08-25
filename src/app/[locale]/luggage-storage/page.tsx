import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { MapPin, ChevronRight } from "lucide-react";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { routing } from "@/i18n/routing";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";
import { buildItemListJsonLd, buildWebPageJsonLd } from "@/lib/page-json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CityStorage" });
  const base = getSiteBaseUrl();
  const canonical = `${base}/${locale}/luggage-storage`;
  const title = t("indexMetaTitle");
  const description = t("indexMetaDescription");
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...routing.locales.map(
          (loc) => [loc, `${base}/${loc}/luggage-storage`] as const
        ),
        ["x-default", `${base}/${routing.defaultLocale}/luggage-storage`] as const,
      ]),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LuggageStorageIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("CityStorage");
  const tCommon = await getTranslations("Common");
  const msg = (key: string, fallback: string) => {
    const tx = t as unknown as { has?: (k: string) => boolean };
    if (typeof tx.has === "function" && tx.has(key)) return t(key as never);
    return fallback;
  };
  const faqs = [
    {
      q: msg("indexFaq1Q", "How can I check which cities are available?"),
      a: msg(
        "indexFaq1A",
        "Select a city from the list to open its dedicated page and start a location-focused search.",
      ),
    },
    {
      q: msg(
        "indexFaq2Q",
        "Does search center update automatically from city pages?",
      ),
      a: msg(
        "indexFaq2A",
        "Yes. City page CTAs open search with that city's center coordinates pre-focused.",
      ),
    },
    {
      q: msg("indexFaq3Q", "Why are city pages important for SEO?"),
      a: msg(
        "indexFaq3A",
        "They match local intent queries directly and improve organic discoverability and conversions.",
      ),
    },
  ];
  const faqJsonLd = buildFaqJsonLd({
    locale,
    path: "/luggage-storage",
    items: faqs.map((f) => ({ question: f.q, answer: f.a })),
  });
  const webPageJsonLd = buildWebPageJsonLd({
    locale,
    path: "/luggage-storage",
    title: t("indexMetaTitle"),
    description: t("indexMetaDescription"),
  });
  const cityItemListJsonLd = buildItemListJsonLd({
    locale,
    path: "/luggage-storage",
    itemNamePrefix: t("indexHeadline"),
    items: STORAGE_CITIES.map((city) => ({
      name: t(`${city.slug}.label`),
      urlPath: `/luggage-storage/${city.slug}`,
    })),
  });

  return (
    <div className="min-h-screen bg-white text-gray-900">
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
      <header className="border-b border-gray-100 bg-gray-50/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link
            href="/"
            className="text-xs id-eyebrow text-gray-400 hover:text-orange-600"
          >
            ← {tCommon("back")}
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">
          <MapPin size={14} aria-hidden />
          {tCommon("appName")}
        </p>
        <h1 className="text-3xl font-black tracking-tight text-gray-900 md:text-4xl">
          {t("indexHeadline")}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-gray-600">
          {t("indexIntro")}
        </p>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {STORAGE_CITIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/luggage-storage/${c.slug}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-5 py-4 transition hover:border-orange-200 hover:bg-white hover:shadow-md"
              >
                <span className="font-bold text-gray-900">
                  {t(`${c.slug}.label`)}
                </span>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:text-orange-600"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-12 rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <h2 className="text-xl font-black text-gray-900">
            {msg("indexWhyTitle", "City-Based Luggage Storage Guide")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {msg(
              "indexWhyBody",
              "Each city page is optimized for local search intent, nearby discovery, and a quick transition into booking flow.",
            )}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-xl font-black text-gray-900">
            {msg("indexFaqTitle", "Frequently Asked Questions")}
          </h2>
          <div className="mt-4 space-y-4">
            {faqs.map((faq) => (
              <article key={faq.q} className="rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-black text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{faq.a}</p>
              </article>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
