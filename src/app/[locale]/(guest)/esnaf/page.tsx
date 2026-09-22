import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Check, ArrowRight, ChevronDown, PhoneCall, Store, Luggage } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { socialMetadata } from "@/lib/social-metadata";
import { getEffectiveCommission } from "@/lib/commission";
import { getPaymentCopyMode } from "@/lib/payment-copy";
import PartnerLeadForm from "@/components/guest/PartnerLeadForm";

/** Komisyon orani DB'den geliyor; revalidate olmadan ilk deploy'daki degerde donar. */
export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PartnerSignup" });
  const base = getSiteBaseUrl();
  const title = t("metaTitle");
  const description = t("metaDescription");
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/esnaf"),
    ...socialMetadata({ url: `${base}/${locale}/esnaf`, title, description }),
  };
}

export default async function PartnerSignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PartnerSignup");

  /*
    "Komisyon yok" yalnizca oran gercekten 0 iken yazilir. PSP baglanip oran
    yururluge girdigi gun metin kendiliginden notr surume doner; elle geri
    alinacak bir vaat birakmiyoruz. Build ortaminda DB yok -> 0'a duser,
    revalidate canlida duzeltir.
  */
  let zeroCommission = true;
  try {
    zeroCommission = (await getEffectiveCommission()).rate === 0;
  } catch {
    // varsayilan kalir
  }

  const perks = [zeroCommission ? t("perkFree") : t("perkFreeSignup"), t("perkCapacity"), t("perkSealed")];

  const steps = [
    { Icon: Store, title: t("step1Title"), body: t("step1Body") },
    { Icon: PhoneCall, title: t("step2Title"), body: t("step2Body") },
    { Icon: Luggage, title: t("step3Title"), body: t("step3Body") },
  ];

  const faqs = [
    { q: t("faq1Q"), a: zeroCommission ? t("faq1A") : t("faq1AWithCommission") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: getPaymentCopyMode() === "online" ? t("faq3A") : t("faq3AOnsite") },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* HERO + FORM */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-20">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="lg:pt-6">
            <p className="id-eyebrow text-xs text-brand-700">{t("eyebrow")}</p>
            <h1 className="id-display mt-3 text-4xl leading-[1.05] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">{t("heroSubtitle")}</p>
            <ul className="mt-7 flex flex-col gap-3">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-3 text-base font-bold text-gray-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div
            id="kayit"
            className="scroll-mt-24 id-surface p-6 sm:p-8"
          >
            <h2 className="text-2xl id-display tracking-tight">{t("formTitle")}</h2>
            <p className="mb-6 mt-1.5 text-sm text-gray-600">{t("formSubtitle")}</p>
            <PartnerLeadForm />
          </div>
        </div>
      </section>

      {/* 3 ADIM */}
      <section className="px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="id-display text-center text-3xl tracking-tight sm:text-4xl">{t("stepsTitle")}</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map(({ Icon, title, body }, i) => (
              <li key={title} className="relative rounded-2xl border border-gray-100 bg-gray-50/70 p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm">
                    <Icon size={22} />
                  </span>
                  <span className="id-eyebrow text-xs text-gray-400">{t("stepLabel", { n: i + 1 })}</span>
                </div>
                <h3 className="mt-5 text-lg id-display">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link href="/esnaf/nasil-calisir" className="btn-ui btn-ui-lg btn-ui-secondary">
              {t("howLink")}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* SSS */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="id-display text-center text-3xl tracking-tight sm:text-4xl">{t("faqTitle")}</h2>
          <div className="mt-10 flex flex-col gap-3">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-gray-100 bg-white px-5 open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown size={20} className="shrink-0 text-gray-400 transition group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* SON CTA */}
      <section className="px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <h2 className="id-display text-3xl tracking-tight sm:text-4xl">{t("finalTitle")}</h2>
          <p className="text-gray-600">{t("finalBody")}</p>
          <a href="#kayit" className="btn-ui btn-ui-lg btn-ui-primary">
            {t("finalCta")}
            <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </div>
  );
}
