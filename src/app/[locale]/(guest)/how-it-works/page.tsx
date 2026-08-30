import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { CalendarCheck, QrCode, ShieldCheck, PackageCheck } from "lucide-react";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import HowItWorksAnimation from "@/components/guest/HowItWorksAnimation";

/**
 * Süreci anlatan sayfa.
 *
 * NEDEN AYRI BİR SAYFA: ana sayfadaki üç kutucuk "ne yapıldığını" söylüyor ama
 * "ne olacağını" söylemiyor — misafirin gerçekten merak ettiği şeyler (kimlik
 * isteniyor mu, valizim açılır mı, geç kalırsam ne olur) hiçbir yerde
 * yazmıyordu. Emanet, güven satan bir hizmet; cevabı olmayan soru rezervasyonu
 * durdurur.
 *
 * Adım metinleri SÜRE ve SOMUT DAVRANIŞ içerir ("bir dakika sürer", "kimlik ya
 * da depozito istenmez", "mühür kopartılmadan çıkarılamaz") — çünkü belirsizlik
 * bırakan bir güven metni, güven vermez.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HowItWorks" });
  const base = getSiteBaseUrl();
  return {
    title: t("metaTitle"),
    description: t("heroSubtitle"),
    alternates: alternatesForPath(locale, "/how-it-works"),
    openGraph: {
      title: t("metaTitle"),
      description: t("heroSubtitle"),
      url: `${base}/${locale}/how-it-works`,
      type: "website",
    },
  };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HowItWorks");

  const steps = [
    { icon: CalendarCheck, title: t("s1Title"), body: t("s1Body") },
    { icon: QrCode, title: t("s2Title"), body: t("s2Body") },
    { icon: ShieldCheck, title: t("s3Title"), body: t("s3Body") },
    { icon: PackageCheck, title: t("s4Title"), body: t("s4Body") },
  ];

  /**
   * HowTo yapısal verisi: arama sonucunda adımların kendisi görünebiliyor.
   * Metinler sayfadakiyle AYNI anahtarlardan geliyor — ayrı yazılsaydı biri
   * güncellenip diğeri unutulurdu.
   */
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: t("heroTitle"),
    description: t("heroSubtitle"),
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <header className="border-b border-gray-100 px-6 py-16 text-center">
        <h1 className="text-3xl id-display tracking-tight md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
          {t("heroSubtitle")}
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 flex flex-col gap-14">
        <section className="text-gray-900">
          <HowItWorksAnimation
            ariaLabel={t("animAria")}
            labels={[t("s1Short"), t("s2Short"), t("s3Short"), t("s4Short")]}
          />
        </section>

        <section className="flex flex-col gap-8">
          {steps.map(({ icon: Icon, title, body }) => (
            <article key={title} className="flex gap-4">
              <div className="shrink-0">
                <Icon size={26} className="id-accent" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-base id-display text-gray-900">{title}</h2>
                <p className="text-sm leading-relaxed text-gray-600">{body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="flex flex-wrap gap-3">
          <Link href="/search" className="btn-ui btn-ui-lg btn-ui-primary">
            {t("ctaGuest")}
          </Link>
          <Link href="/become-partner" className="btn-ui btn-ui-lg btn-ui-secondary">
            {t("ctaPartner")}
          </Link>
        </section>
      </main>
    </div>
  );
}
