import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Search } from "lucide-react";
import { getStorageCity, STORAGE_CITIES } from "@/lib/storage-cities";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { routing } from "@/i18n/routing";

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
  return {
    title: t(`${slug}.metaTitle`),
    description: t(`${slug}.metaDescription`),
    alternates: {
      canonical: `${base}/${locale}/luggage-storage/${slug}`,
      languages: {
        tr: `${base}/tr/luggage-storage/${slug}`,
        en: `${base}/en/luggage-storage/${slug}`,
        "x-default": `${base}/${routing.defaultLocale}/luggage-storage/${slug}`,
      },
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
  const q = encodeURIComponent(t(`${slug}.searchQuery`));
  const searchHref = `/search?q=${q}&lat=${city.lat}&lng=${city.lng}`;

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
      </article>
    </div>
  );
}
