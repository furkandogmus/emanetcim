import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ShieldCheck, CircleCheck, Wrench, SearchCheck } from "lucide-react";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";
import { isInsuranceEnabled } from "@/lib/commerce-context";
import { getPricingRules } from "@/lib/platform-settings";
import { socialMetadata } from "@/lib/social-metadata";
import { serializeJsonLd } from "@/lib/json-ld-script";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Insurance" });
  const title = t("title");
  const description = t("subtitle");
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/insurance"),
    ...socialMetadata({
      url: `${getSiteBaseUrl()}/${locale}/insurance`,
      title,
      description,
    }),
  };
}

export default async function InsurancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Kurallar burada bir kez okunuyor; kök layout'un DB'ye dokunmasına gerek yok.
  const insuranceEnabled = isInsuranceEnabled(await getPricingRules());
  const t = await getTranslations("Insurance");
  const faqItems = [
    { question: t("faq1Question"), answer: t("faq1Answer") },
    { question: t("faq2Question"), answer: t("faq2Answer") },
    { question: t("faq3Question"), answer: t("faq3Answer") },
  ];
  const faqJsonLd = buildFaqJsonLd({
    locale,
    path: "/insurance",
    items: faqItems,
  });

  return (
    <div className="min-h-screen bg-[#f5f6fb]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          {/*
            GÜVENCE ETKİN DEĞİLKEN AÇIKÇA SÖYLENİR.

            Sayfa "çanta başına 10.000 TL" vaat ediyor ama canlı
            `insuranceFeeTry = 0` — yani karşılığı toplanmıyor ve arkasında bir
            sigortacı yok (P1-20). Rakamları sessizce göstermek, az önce
            kaldırılan sahte partner şeridiyle aynı sınıf bir yanlış beyandır.

            Sayfa kaldırılmadı çünkü anlattığı SÜREÇ gerçek: mühürleme, teslim
            kaydı ve anlaşmazlık akışı bugün de işliyor. Ücret belirlendiği an
            bu uyarı kendiliğinden kaybolur.
          */}
          {!insuranceEnabled ? (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-black text-amber-900">
                {t("notActiveTitle")}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-amber-800">
                {t("notActiveBody")}
              </p>
            </div>
          ) : null}
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            {t("badge")}
          </p>
          <h1 className="mt-3 text-5xl leading-[0.95] font-black tracking-tight text-gray-900">
            {t("heroTitle")}
            <br />
            {t("heroTitle2")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-500 max-w-md">
            {t("subtitle")}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
            <ShieldCheck size={14} /> {t("thresholdTitle")}
          </div>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-slate-700 via-slate-800 to-gray-900 p-8 min-h-[270px] shadow-2xl">
          <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 flex flex-col justify-between">
            <p className="text-xs id-eyebrow text-white/60">
              {t("peaceOfMind")}
            </p>
            <p className="text-sm text-white/80 leading-relaxed">{t("antiTheftBody")}</p>
          </div>
        </div>
      </section>

      <section className="bg-[#eef1fb] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-4xl font-black text-gray-900">{t("coverageTitle")}</h2>
          <p className="mt-2 text-center text-sm text-gray-500">{t("coverageSubtitle")}</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
            <article className="rounded-3xl bg-white border border-gray-100 p-6">
              <h3 className="text-2xl font-black text-gray-900">{t("thresholdTitle")}</h3>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{t("thresholdBody")}</p>
              <ul className="mt-5 space-y-3 text-sm font-bold text-gray-700">
                <li className="flex items-center gap-2">
                  <CircleCheck size={16} className="text-emerald-600" />
                  {t("card1")}
                </li>
                <li className="flex items-center gap-2">
                  <CircleCheck size={16} className="text-emerald-600" />
                  {t("card2")}
                </li>
                <li className="flex items-center gap-2">
                  <CircleCheck size={16} className="text-emerald-600" />
                  {t("card3")}
                </li>
              </ul>
            </article>
            <article className="rounded-3xl bg-teal-700 text-white p-6">
              <h3 className="text-2xl font-black">{t("antiTheftTitle")}</h3>
              <p className="mt-3 text-sm text-white/85 leading-relaxed">{t("antiTheftBody")}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-white border border-gray-100 p-6">
          <h2 className="text-3xl font-black text-gray-900">{t("stepsTitle")}</h2>
          <ol className="mt-6 space-y-5 text-sm">
            <li>
              <p className="font-black text-gray-900 flex items-center gap-2">
                <SearchCheck size={16} className="text-orange-600" />
                {t("step1Title")}
              </p>
              <p className="mt-1 text-gray-600">{t("step1Body")}</p>
            </li>
            <li>
              <p className="font-black text-gray-900 flex items-center gap-2">
                <Wrench size={16} className="text-orange-600" />
                {t("step2Title")}
              </p>
              <p className="mt-1 text-gray-600">{t("step2Body")}</p>
            </li>
            <li>
              <p className="font-black text-gray-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-orange-600" />
                {t("step3Title")}
              </p>
              <p className="mt-1 text-gray-600">{t("step3Body")}</p>
            </li>
          </ol>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-100 p-8 flex items-center justify-center">
          <p className="text-xl font-black text-gray-700 text-center">{t("stepsTitle")}.</p>
        </div>
      </section>

      {/*
        SAHTE PARTNER ŞERİDİ KALDIRILDI (2026-08-22).

        Burada "AXA Alliance", "SecureGate", "UrbanShield", "TravelClaim Grid"
        isimleri bir güven şeridi olarak gösteriliyordu. **AXA gerçek ve tescilli
        bir sigorta markasıdır** ve böyle bir ortaklık yok; diğer üçü de uydurma.
        Halka açık ticari bir sayfada, adı geçen üçüncü taraf hakkında yanlış
        beyandır — bir hata değil, hukuki risktir.

        Gerçek bir sigorta ortaklığı kurulursa buraya SÖZLEŞMESİ OLAN taraflar
        yazılır. Yer doldurmak için marka adı yazılmaz.
      */}

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl bg-gradient-to-r from-orange-700 to-orange-500 p-10 text-white text-center">
          <h2 className="text-4xl font-black">{t("ctaTitle")}</h2>
          <p className="mt-2 text-white/85">{t("ctaBody")}</p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/search" className="btn-ui btn-ui-md btn-ui-secondary rounded-full">
              {t("ctaPrimary")}
            </Link>
            <Link href="/bookings" className="btn-ui btn-ui-md btn-ui-ghost rounded-full bg-white/15 text-white border-white/30 hover:bg-white/25">
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

