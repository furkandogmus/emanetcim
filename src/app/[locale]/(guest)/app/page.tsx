import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Smartphone } from "lucide-react";
import { Link } from "@/i18n/routing";
import StoreBadges from "@/components/app-promo/StoreBadges";
import {
  ANDROID_PLAY_URL,
  APP_DOWNLOAD_URL,
  IOS_APP_STORE_URL,
  anyStoreLive,
  getAppStoreFlags,
} from "@/lib/app-stores";
import { qrSvg } from "@/lib/qr-svg";

/** Bayrak ac/kapa en gec bir dakikada yansir; sayfa build'de veritabanisiz uretilir. */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AppDownload" });
  // Ince bir yonlendirme sayfasi: arama sonucuna girmesi istenmiyor.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

export default async function AppDownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AppDownload");
  const flags = await getAppStoreFlags();
  const live = anyStoreLive(flags);
  const qr = await qrSvg(APP_DOWNLOAD_URL);

  return (
    <div className="min-h-[70vh] bg-white px-6 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900">
          <Smartphone size={28} className="text-white" aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="id-display text-3xl text-gray-900 md:text-4xl">{t("title")}</h1>
          <p className="text-base text-gray-600" data-testid="app-landing-lead">
            {live ? t("lead") : t("comingSoon")}
          </p>
        </div>

        {live ? (
          <StoreBadges
            flags={flags}
            iosHref={IOS_APP_STORE_URL}
            androidHref={ANDROID_PLAY_URL}
            labels={{ appStore: t("appStoreAlt"), googlePlay: t("googlePlayAlt") }}
            height={48}
            className="justify-center"
          />
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-2 id-accent-bg rounded-xl px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90"
          >
            {t("websiteCta")}
          </Link>
        )}

        <figure className="flex flex-col items-center gap-3">
          <div
            className="h-44 w-44 rounded-2xl border border-gray-100 bg-white p-3 [&_svg]:h-full [&_svg]:w-full"
            role="img"
            aria-label={t("qrAlt")}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <figcaption className="text-xs font-bold text-gray-500">{t("qrCaption")}</figcaption>
        </figure>
      </div>
    </div>
  );
}
