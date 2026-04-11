import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { MapPin, ChevronRight } from "lucide-react";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CityStorage" });
  const base = getSiteBaseUrl();
  const canonical = `${base}/${locale}/luggage-storage`;
  return {
    title: t("indexMetaTitle"),
    description: t("indexMetaDescription"),
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
      title: t("indexMetaTitle"),
      description: t("indexMetaDescription"),
      url: canonical,
      type: "website",
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
      </article>
    </div>
  );
}
