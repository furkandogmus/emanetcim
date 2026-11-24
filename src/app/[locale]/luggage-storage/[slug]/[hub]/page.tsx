import { cache } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Search, Clock } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getTransitHub, hubPath, hubRadiusKm } from "@/lib/transit-hubs";
import { getHubShops, isHubIndexable } from "@/lib/transit-hub-shops";
import { buildHubShopsItemListJsonLd } from "@/lib/transit-hub-json-ld";
import { formatDistance } from "@/lib/format-distance";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { socialMetadata } from "@/lib/social-metadata";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-json-ld";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";
import { serializeJsonLd } from "@/lib/json-ld-script";
import HubShopsMap from "@/components/guest/HubShopsMap";
import PrelaunchDemandPanel from "@/components/guest/PrelaunchDemandPanel";

// Sehir sayfasiyla ayni tazelik; acik/kapali rozeti en fazla 5 dakika eskir.
export const revalidate = 300;

// Build'de veritabani yok: bos listeyle uretilip `noindex` basilmasin, ilk istekte uretilsin.
export function generateStaticParams() {
  return [];
}

const loadHubShops = cache(async (city: string, slug: string) => {
  const hub = getTransitHub(city, slug);
  return hub ? { hub, result: await getHubShops(hub) } : null;
});

type Params = Promise<{ locale: string; slug: string; hub: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug, hub: hubSlug } = await params;
  const loaded = await loadHubShops(slug, hubSlug);
  if (!loaded) return {};
  const { hub, result } = loaded;
  const t = await getTranslations({ locale, namespace: "TransitHubs" });
  const tCity = await getTranslations({ locale, namespace: "CityStorage" });
  const near = t(`hubs.${hub.slug}.near`);
  const indexable = isHubIndexable(result);
  const title = t("metaTitle", { near });
  const description = indexable
    ? t("metaDescription", { near, city: tCity(`${hub.city}.label`) })
    : t("metaDescriptionEmpty", { near });
  return {
    title,
    description,
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    alternates: alternatesForPath(locale, hubPath(hub)),
    ...socialMetadata({ url: `${getSiteBaseUrl()}/${locale}${hubPath(hub)}`, title, description }),
  };
}

export default async function TransitHubPage({ params }: { params: Params }) {
  const { locale, slug, hub: hubSlug } = await params;
  const loaded = await loadHubShops(slug, hubSlug);
  if (!loaded) notFound();
  setRequestLocale(locale);
  const { hub, result } = loaded;
  const { shops, prelaunch } = result;

  const t = await getTranslations("TransitHubs");
  const tCity = await getTranslations("CityStorage");
  const tCommon = await getTranslations("Common");
  const name = t(`hubs.${hub.slug}.name`);
  const near = t(`hubs.${hub.slug}.near`);
  const cityLabel = tCity(`${hub.city}.label`);
  const path = hubPath(hub);
  const distanceText = (km: number) => {
    const d = formatDistance(km, locale);
    return t(d.key === "awayMeters" ? "distanceM" : "distanceKm", { distance: d.value });
  };

  const faqs = [
    ...(shops.length > 0
      ? [{ q: t("faqNearestQ", { near }), a: t("faqNearestA", { shop: shops[0].name, distance: distanceText(shops[0].distanceKm) }) }]
      : []),
    { q: t(`kinds.${hub.kind}.faqQ`), a: t(`kinds.${hub.kind}.faqA`) },
    { q: t("faqPayQ"), a: t("faqPayA") },
    { q: t("faqCancelQ"), a: t("faqCancelA") },
  ];
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: tCommon("mobileNavHome"), path: `/${locale}` },
    { name: cityLabel, path: `/${locale}/luggage-storage/${hub.city}` },
    { name, path: `/${locale}${path}` },
  ]);
  const faqLd = buildFaqJsonLd({ locale, path, items: faqs.map((f) => ({ question: f.q, answer: f.a })) });
  const listLd =
    shops.length > 0
      ? buildHubShopsItemListJsonLd({ locale, path, name: t("shopsTitle", { near }), shops })
      : null;
  const searchHref = `/search?q=${encodeURIComponent(name)}&lat=${hub.lat}&lng=${hub.lng}`;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100 bg-gray-50/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link
            href={`/luggage-storage/${hub.city}`}
            className="inline-block py-2 -my-2 text-xs id-eyebrow text-gray-400 hover:underline"
          >
            ← {t("cityLink", { city: cityLabel })}
          </Link>
        </div>
      </header>

      {[breadcrumbLd, faqLd, ...(listLd ? [listLd] : [])].map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
      ))}

      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <p className="mb-3 inline-flex items-center gap-2 text-[11px] id-eyebrow id-accent">
          <MapPin size={14} aria-hidden />
          {cityLabel}
        </p>
        <h1 className="text-3xl id-display tracking-tight text-gray-900 md:text-4xl">
          {t("headline", { near })}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-gray-600">{t(`hubs.${hub.slug}.intro`)}</p>

        {shops.length > 0 ? (
          <>
            <Link
              href={searchHref}
              className="btn-ui btn-ui-lg btn-ui-primary mt-10 inline-flex items-center gap-3"
            >
              <Search size={20} aria-hidden />
              {t("searchCta", { near })}
            </Link>

            <section className="mt-12 rounded-2xl border border-gray-100 bg-white p-6" aria-labelledby="hub-shops-title">
              <h2 id="hub-shops-title" className="text-xl id-display text-gray-900">
                {t("shopsTitle", { near })}
              </h2>
              <p className="mt-1 text-xs text-gray-500">{t("shopsNote", { radius: hubRadiusKm(hub) })}</p>
              <div className="mt-4" role="region" aria-label={t("mapLabel", { near })}>
                <HubShopsMap
                  center={{ lat: hub.lat, lng: hub.lng }}
                  shops={shops.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude }))}
                />
              </div>
              <ul className="mt-4 divide-y divide-gray-100">
                {shops.map((shop) => (
                  <li key={shop.id}>
                    <Link
                      href={`/shop/${shop.id}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm hover:underline"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold text-gray-900">{shop.name}</span>
                        <span className="block text-xs text-gray-500">
                          {[shop.district, distanceText(shop.distanceKm)].filter(Boolean).join(" · ")}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={12} aria-hidden />
                          {shop.todayHours
                            ? shop.todayHours.open === "00:00" && shop.todayHours.close === "23:59"
                              ? t("open247")
                              : t("todayHours", { open: shop.todayHours.open, close: shop.todayHours.close })
                            : t("closedToday")}
                        </span>
                      </span>
                      <span
                        className={
                          shop.openNow
                            ? "shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700"
                            : "shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600"
                        }
                      >
                        {shop.openNow ? t("openNow") : t("closedNow")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <section className="mt-12 flex flex-col gap-4" aria-labelledby="hub-empty-title">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
              <h2 id="hub-empty-title" className="text-xl id-display text-gray-900">
                {t("emptyTitle", { near })}
              </h2>
              <p className="mt-2 text-sm text-gray-600">{t("emptyBody")}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
                <Link href={`/luggage-storage/${hub.city}`} className="id-accent hover:underline">
                  {t("cityLink", { city: cityLabel })}
                </Link>
                <Link href="/become-partner" className="text-gray-700 hover:underline">
                  {t("emptyPartner", { near })}
                </Link>
              </div>
            </div>
            {prelaunch && (
              <PrelaunchDemandPanel
                shopId={prelaunch.id}
                shopName={prelaunch.name}
                initialWantCount={prelaunch.wantCount}
              />
            )}
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-xl id-display text-gray-900">{t("gettingThereTitle")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{t(`hubs.${hub.slug}.gettingThere`)}</p>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <h2 className="text-xl id-display text-gray-900">{t("tipsTitle")}</h2>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            {(["tip1", "tip2", "tip3"] as const).map((k) => (
              <li key={k}>{t(`kinds.${hub.kind}.${k}`)}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-xl id-display text-gray-900">{t("howTitle")}</h2>
          <ol className="mt-4 space-y-2 text-sm text-gray-600">
            {(["how1", "how2", "how3"] as const).map((k, i) => (
              <li key={k}>
                {i + 1}. {t(k)}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-xl id-display text-gray-900">{t("faqTitle")}</h2>
          <div className="mt-4 space-y-4">
            {faqs.map((faq) => (
              <article key={faq.q} className="rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm id-display text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{faq.a}</p>
              </article>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
