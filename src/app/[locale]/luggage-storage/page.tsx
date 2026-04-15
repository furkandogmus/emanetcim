import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { MapPin, ChevronRight } from "lucide-react";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { routing } from "@/i18n/routing";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";

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
  const localeCopy =
    locale === "tr"
      ? {
          whyTitle: "Şehir Bazlı Bagaj Emanet Rehberi",
          whyBody:
            "Her şehir için özel hazırlanmış sayfalarda popüler bölgeler, arama niyetleri ve hızlı rezervasyon akışı tek noktada sunulur.",
          faqTitle: "Sık Sorulan Sorular",
          faqs: [
            {
              q: "Hangi şehirde emanet noktası olduğunu nasıl görürüm?",
              a: "Listeden şehir seçerek ilgili şehir sayfasına geçebilir ve aramayı o lokasyona odaklı başlatabilirsiniz.",
            },
            {
              q: "Şehir sayfasından aramaya geçince merkez otomatik ayarlanır mı?",
              a: "Evet. Şehir sayfasındaki aksiyon butonları aramayı o şehrin merkez koordinatlarıyla başlatır.",
            },
            {
              q: "Şehir bazlı sayfalar SEO için neden önemli?",
              a: "Yerel arama niyetlerini (ör. Ankara bagaj emanet) doğrudan karşılayarak organik görünürlüğü ve dönüşüm olasılığını artırır.",
            },
          ],
        }
      : {
          whyTitle: "City-Based Luggage Storage Guide",
          whyBody:
            "Each city page is optimized for local search intent, nearby discovery, and a quick transition into booking flow.",
          faqTitle: "Frequently Asked Questions",
          faqs: [
            {
              q: "How can I check which cities are available?",
              a: "Select a city from the list to open its dedicated page and start a location-focused search.",
            },
            {
              q: "Does search center update automatically from city pages?",
              a: "Yes. City page CTAs open search with that city's center coordinates pre-focused.",
            },
            {
              q: "Why are city pages important for SEO?",
              a: "They match local intent queries directly (for example, 'luggage storage Ankara') and improve organic discoverability and conversions.",
            },
          ],
        };
  const faqJsonLd = buildFaqJsonLd({
    locale,
    path: "/luggage-storage",
    items: localeCopy.faqs.map((f) => ({ question: f.q, answer: f.a })),
  });

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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

        <section className="mt-12 rounded-[1.5rem] border border-gray-100 bg-gray-50 p-6">
          <h2 className="text-xl font-black text-gray-900">{localeCopy.whyTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{localeCopy.whyBody}</p>
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
      </article>
    </div>
  );
}
