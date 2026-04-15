import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ShieldCheck, CircleCheck, Wrench, SearchCheck } from "lucide-react";
import { alternatesForPath } from "@/lib/seo-alternates";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";

const copy = {
  tr: {
    title: "Bagaj Güvencesi",
    subtitle:
      "Seyahat hafifler, içiniz rahat eder. BagajPark rezervasyonlarında platform kurallarına göre çanta başına güvence uygulanır.",
    badge: "GÜVENLİK MÜKEMMELLİĞİ",
    heroTitle: "Transit Güvence",
    heroTitle2: "Koruması",
    coverageTitle: "Kapsam Özeti",
    coverageSubtitle:
      "Koşullar sağlandığında platform koruması devreye girer. Ayrıntılar kullanım şartlarında tanımlıdır.",
    thresholdTitle: "Çanta Başına 5.000 TL",
    thresholdBody:
      "Hasar veya kayıp bildirimlerinde süreç şartlara göre ilerler. Mühür ve teslim fotoğrafı kayıtları değerlendirmede kullanılır.",
    antiTheftTitle: "Hırsızlık ve Hasar Koruması",
    antiTheftBody:
      "Uygun olaylarda, doğrulama sonrası çanta başına üst limite kadar güvence sağlanır.",
    card1: "Emanet zinciri kaydı",
    card2: "Mühür ve fotoğraf doğrulaması",
    card3: "Yetkili inceleme",
    stepsTitle: "Basit, Dijital, Hızlı",
    step1Title: "Olayı Bildirin",
    step1Body: "Uygulama içinden rezervasyon detayındaki şikayet akışını başlatın.",
    step2Title: "Kanıtları Gönderin",
    step2Body: "Fotoğraf, mühür ve açıklama bilgilerini ekleyin.",
    step3Title: "Değerlendirme",
    step3Body: "Destek ekibi inceleyip sonucu size bildirir.",
    ctaTitle: "Şehri Kaygısız Gezin",
    ctaBody: "Bagajınızı güvenle bırakın, gününüzü özgürce yaşayın.",
    ctaPrimary: "Emanet Noktası Bul",
    ctaSecondary: "Rezervasyonlarım",
    peaceOfMind: "Tam İç Huzuru",
    partnerLogos: ["AXA Alliance", "SecureGate", "UrbanShield", "TravelClaim Grid"],
  },
  en: {
    title: "Storage Protection",
    subtitle:
      "Travel light with peace of mind. BagajPark bookings include per-bag protection under platform terms.",
    badge: "SECURITY EXCELLENCE",
    heroTitle: "Transit Trust",
    heroTitle2: "Guarantee",
    coverageTitle: "Comprehensive Coverage",
    coverageSubtitle:
      "When conditions are met, platform protection applies. Full details are defined in Terms.",
    thresholdTitle: "5,000 TL Per Bag",
    thresholdBody:
      "Loss or damage reports are handled according to policy terms. Seal and drop-off records support validation.",
    antiTheftTitle: "Anti-Theft Protection",
    antiTheftBody:
      "For eligible incidents, verified claims are covered up to the per-bag protection limit.",
    card1: "Chain-of-custody records",
    card2: "Seal and photo verification",
    card3: "Support team review",
    stepsTitle: "Simple, Digital, Human",
    step1Title: "Document the incident",
    step1Body: "Start a dispute from your booking detail in the app.",
    step2Title: "Submit evidence",
    step2Body: "Upload photos, seal info, and a clear explanation.",
    step3Title: "Rapid resolution",
    step3Body: "Our team reviews and shares the outcome quickly.",
    ctaTitle: "Ready for a worry-free city tour?",
    ctaBody: "Store your luggage safely and enjoy your day.",
    ctaPrimary: "Find a Storage Point",
    ctaSecondary: "Book now",
    peaceOfMind: "Total peace of mind",
    partnerLogos: ["AXA Alliance", "SecureGate", "UrbanShield", "TravelClaim Grid"],
  },
} as const;

function byLocale(locale: string) {
  return locale === "tr" ? copy.tr : copy.en;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = byLocale(locale);
  return {
    title: c.title,
    description: c.subtitle,
    alternates: alternatesForPath(locale, "/insurance"),
    openGraph: {
      title: c.title,
      description: c.subtitle,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: c.title,
      description: c.subtitle,
    },
  };
}

export default async function InsurancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = byLocale(locale);
  const faqItems =
    locale === "tr"
      ? [
          {
            question: "Bagaj güvencesi hangi durumda devreye girer?",
            answer:
              "Platform kurallarında belirtilen şartlar karşılandığında, doğrulama süreci sonrası ilgili koruma akışı uygulanır.",
          },
          {
            question: "Olay bildirimini nasıl yaparım?",
            answer:
              "Rezervasyon detayındaki şikayet/dispute akışını başlatarak fotoğraf, mühür bilgisi ve açıklama ekleyebilirsiniz.",
          },
          {
            question: "Koruma tutarı nasıl belirlenir?",
            answer:
              "Uygun olaylarda değerlendirme sonucu çanta başına tanımlı üst limit dahilinde işlem yapılır.",
          },
        ]
      : [
          {
            question: "When does storage protection apply?",
            answer:
              "Protection flow applies when eligibility criteria in platform terms are met and verification is completed.",
          },
          {
            question: "How can I report an incident?",
            answer:
              "Open a dispute from booking details and submit photos, seal information, and a clear description.",
          },
          {
            question: "How is protection amount determined?",
            answer:
              "For eligible incidents, review outcome is handled within the per-bag protection limit defined by platform policy.",
          },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            {c.badge}
          </p>
          <h1 className="mt-3 text-5xl leading-[0.95] font-black tracking-tight text-gray-900">
            {c.heroTitle}
            <br />
            {c.heroTitle2}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-500 max-w-md">
            {c.subtitle}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
            <ShieldCheck size={14} /> {c.thresholdTitle}
          </div>
        </div>
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-700 via-slate-800 to-gray-900 p-8 min-h-[270px] shadow-2xl">
          <div className="h-full rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur p-6 flex flex-col justify-between">
            <p className="text-xs uppercase tracking-widest text-white/60 font-black">
              {c.peaceOfMind}
            </p>
            <p className="text-sm text-white/80 leading-relaxed">{c.antiTheftBody}</p>
          </div>
        </div>
      </section>

      <section className="bg-[#eef1fb] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-4xl font-black text-gray-900">{c.coverageTitle}</h2>
          <p className="mt-2 text-center text-sm text-gray-500">{c.coverageSubtitle}</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
            <article className="rounded-[2rem] bg-white border border-gray-100 p-6">
              <h3 className="text-2xl font-black text-gray-900">{c.thresholdTitle}</h3>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{c.thresholdBody}</p>
              <ul className="mt-5 space-y-3 text-sm font-bold text-gray-700">
                <li className="flex items-center gap-2">
                  <CircleCheck size={16} className="text-emerald-600" />
                  {c.card1}
                </li>
                <li className="flex items-center gap-2">
                  <CircleCheck size={16} className="text-emerald-600" />
                  {c.card2}
                </li>
                <li className="flex items-center gap-2">
                  <CircleCheck size={16} className="text-emerald-600" />
                  {c.card3}
                </li>
              </ul>
            </article>
            <article className="rounded-[2rem] bg-teal-700 text-white p-6">
              <h3 className="text-2xl font-black">{c.antiTheftTitle}</h3>
              <p className="mt-3 text-sm text-white/85 leading-relaxed">{c.antiTheftBody}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-[2rem] bg-white border border-gray-100 p-6">
          <h2 className="text-3xl font-black text-gray-900">{c.stepsTitle}</h2>
          <ol className="mt-6 space-y-5 text-sm">
            <li>
              <p className="font-black text-gray-900 flex items-center gap-2">
                <SearchCheck size={16} className="text-orange-600" />
                {c.step1Title}
              </p>
              <p className="mt-1 text-gray-600">{c.step1Body}</p>
            </li>
            <li>
              <p className="font-black text-gray-900 flex items-center gap-2">
                <Wrench size={16} className="text-orange-600" />
                {c.step2Title}
              </p>
              <p className="mt-1 text-gray-600">{c.step2Body}</p>
            </li>
            <li>
              <p className="font-black text-gray-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-orange-600" />
                {c.step3Title}
              </p>
              <p className="mt-1 text-gray-600">{c.step3Body}</p>
            </li>
          </ol>
        </div>
        <div className="rounded-[2rem] bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-100 p-8 flex items-center justify-center">
          <p className="text-xl font-black text-gray-700 text-center">{c.stepsTitle}.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-black uppercase tracking-wider text-gray-400">
          {c.partnerLogos.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] bg-gradient-to-r from-orange-700 to-orange-500 p-10 text-white text-center">
          <h2 className="text-4xl font-black">{c.ctaTitle}</h2>
          <p className="mt-2 text-white/85">{c.ctaBody}</p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/search" className="btn-ui btn-ui-md btn-ui-secondary rounded-full">
              {c.ctaPrimary}
            </Link>
            <Link href="/bookings" className="btn-ui btn-ui-md btn-ui-ghost rounded-full bg-white/15 text-white border-white/30 hover:bg-white/25">
              {c.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

