import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MapPin, ShieldCheck, Clock, Star, Smartphone, Map, QrCode, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getGuestLandingStats } from "@/lib/guest-landing-stats";
import { getHomeTestimonials } from "@/lib/home-testimonials";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import TestimonialCarousel from "@/components/guest/TestimonialCarousel";
import ComparisonTable from "@/components/guest/ComparisonTable";
import BagProtection from "@/components/guest/BagProtection";
import PartnerPromoModal from "@/components/partner/PartnerPromoModal";
import HomeSearchWidget from "@/components/guest/HomeSearchWidget";
import { defaultStayWindowLocalValues } from "@/lib/datetime-local";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { buildFaqJsonLd } from "@/lib/faq-json-ld";
import { buildItemListJsonLd, buildWebPageJsonLd } from "@/lib/page-json-ld";
import { formatDecimal } from "@/lib/currency";
import { getPricingRules } from "@/lib/platform-settings";
import { isInsuranceEnabled } from "@/lib/commerce-context";
import AmbientBackdrop from "@/components/common/AmbientBackdrop";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = getSiteBaseUrl();
  const t = await getTranslations({ locale, namespace: "Guest" });
  const tHome = await getTranslations({ locale, namespace: "Home" });
  /**
   * SEO başlığı 14 dilde. Eskiden `locale === "tr" ? ... : ...` idi, yani ana sayfa
   * 12 dilde İNGİLİZCE başlıkla indeksleniyordu — Almanca arayan biri için
   * "Gepäckaufbewahrung" hiçbir yerde geçmiyordu. Ürün organik aramaya dayandığı
   * için bu doğrudan görünürlük kaybı.
   */
  const title = tHome("seoTitle");
  const description = t("heroSubtitle");
  /*
    MARKA EKI ELLE: `[locale]/layout.tsx` icinde `title.template` = "%s |
    BagajPark" var, ama Next'te bu sablon AYNI SEGMENTTEKI `page.tsx`e
    uygulanmaz -- yalnizca ALT segmentlere. Sonuc olculdu (2026-08-31):

      /tr          "Bagaj Emanet ve Valiz Depolama"        <- marka YOK
      /tr/search   "Emanet noktasi ara | Harita | BagajPark"
      /tr/faq      "Sikca Sorulan Sorular | BagajPark"

    Yani sitenin EN COK yer imine eklenen ve paylasilan sayfasi, sekme
    seridinde kimin sitesi oldugunu soylemiyordu. Sablonun yaptigi ekin
    aynisi burada elle yapiliyor.

    `openGraph`/`twitter` basligi bilerek EKSIZ kaliyor: paylasim kartinda
    marka zaten `siteName` alanindan geliyor, iki kez yazmak gereksiz.
  */
  return {
    title: `${title} | BagajPark`,
    description,
    alternates: alternatesForPath(locale, ""),
    openGraph: {
      url: `${base}/${locale}`,
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Guest Landing Page - Turist Karşılama Sayfası
 * Minimalist, güven veren ve hızlı aksiyon odaklı tasarım.
 */
export default async function GuestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Guest");
  const msg = (key: string, fallback: string) => {
    const tx = t as unknown as { has?: (k: string) => boolean };
    if (typeof tx.has === "function" && tx.has(key)) return t(key as never);
    return fallback;
  };
  const tCity = await getTranslations("CityStorage");
  const tHome = await getTranslations("Home");
  const [stats, testimonials, pricingRules] = await Promise.all([
    getGuestLandingStats(),
    getHomeTestimonials(14),
    getPricingRules(),
  ]);
  const insuranceEnabled = isInsuranceEnabled(pricingRules);
  // Arama kutusunun varsayilanlari burada, SUNUCUDA uretilir. Istemcide
  // uretilirse sunucu (UTC) ile ziyaretcinin saat dilimi farkli metin verir ve
  // hydration'da #418 metin uyusmazligi olusur.
  const stayWindow = defaultStayWindowLocalValues();
  // Bu harita 14->6 dil geçişinde (2026-08-22) güncellenmemiş kalıp hâlâ
  // kaldırılmış es/it içeriyor, ja/fa'yı hiç tanımıyordu -- o iki dilde ana
  // sayfanın güven istatistikleri (lokasyon/konaklama/yorum sayısı) sessizce
  // en-US biçimiyle gösteriliyordu.
  const nfLocale: Record<string, string> = {
    tr: "tr-TR",
    en: "en-US",
    de: "de-DE",
    fr: "fr-FR",
    ja: "ja-JP",
    fa: "fa-IR",
  };
  const nf = new Intl.NumberFormat(nfLocale[locale] ?? "en-US");
  const faqItems = [
    {
      question: msg("homeFaq1Q", "How long does luggage storage booking take?"),
      answer: msg(
        "homeFaq1A",
        "After selecting your dates and bag count, you can typically complete booking in just a few minutes.",
      ),
    },
    {
      question: msg("homeFaq2Q", "How is luggage storage pricing calculated?"),
      answer: msg(
        "homeFaq2A",
        "Total price is based on bag count, duration, and platform rules, and is shown clearly during checkout.",
      ),
    },
    {
      question: msg("homeFaq3Q", "Which cities are available?"),
      answer: msg(
        "homeFaq3A",
        "You can browse active storage points from city pages including Istanbul, Ankara, Izmir, and other major destinations.",
      ),
    },
  ];
  const faqJsonLd = buildFaqJsonLd({
    locale,
    path: "",
    items: faqItems,
  });
  const webPageJsonLd = buildWebPageJsonLd({
    locale,
    path: "",
    // Ekrandaki/metadata'daki başlıkla AYNI kaynak — JSON-LD'ye başka bir şey
    // vermek Google'a çelişkili sinyal göndermek olurdu.
    title: tHome("seoTitle"),
    description: t("heroSubtitle"),
  });
  const cityItemListJsonLd = buildItemListJsonLd({
    locale,
    path: "",
    itemNamePrefix: t("cityHubTitle"),
    items: STORAGE_CITIES.map((city) => ({
      name: tCity(`${city.slug}.label`),
      urlPath: `/luggage-storage/${city.slug}`,
    })),
  });
  const editorialCopy = {
    visualTitle: tHome("visualTitle"),
    visualBody: tHome("visualBody"),
    visualCards: [
      {
        title: tHome("visualCard1Title"),
        text: tHome("visualCard1Text"),
        image:
          "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: tHome("visualCard2Title"),
        text: tHome("visualCard2Text"),
        image:
          "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: tHome("visualCard3Title"),
        text: tHome("visualCard3Text"),
        image:
          "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    seoTitle: tHome("aboutTitle"),
    seoParagraphs: [
      tHome("aboutParagraph1"),
      tHome("aboutParagraph2"),
      tHome("aboutParagraph3"),
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
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
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-gray-50 px-6 pt-14 pb-6 flex flex-col items-center text-center md:pt-32 md:pb-20">
        {/*
          Sıcak ışık + nokta dokusu. Eski hâli düz gri zemin üzerinde tek başına
          duran bir başlıktı; markanın turuncusu hero'da hiç görünmüyordu.
        */}
        <AmbientBackdrop />

        {/*
          Kap `max-w-2xl` (672 px) idi ve arama kutusu de onun icindeydi, yani
          kutu 672 pikselden genis olamiyordu. Tek satirlik duzen ise dile gore
          750-790 px istiyor: TR 42+32 px, DE 36+35 px, FR 50+50 px tarih metni
          kirpiliyordu (2026-08-31'de 640-1440 px arasi her genislikte olculdu).
          Baslik ve alt baslik dar kalmaya devam ediyor; genisleyen yalnizca
          arama kutusu.
        */}
        <div className="relative z-10 w-full max-w-4xl">
          <h1 className="mx-auto max-w-2xl text-3xl md:text-6xl font-black tracking-tight text-gray-900 mb-3 md:mb-6 leading-[1.15] md:leading-[1.1]">
            {t('heroTitle')}
          </h1>
          <p className="text-base md:text-lg text-gray-500 mb-6 md:mb-10 max-w-md mx-auto">
            {t('heroSubtitle')}
          </p>

          {/* Interactive Search Widget — varsayilanlar burada, sunucuda uretilir;
              istemcide `new Date()` cagirmak hydration uyusmazligi veriyordu. */}
          <HomeSearchWidget
            defaultCheckIn={stayWindow.checkIn}
            defaultCheckOut={stayWindow.checkOut}
          />
        </div>
      </header>

      {/* How It Works Section */}
      <section className="py-16 px-6 bg-white" aria-label={t("howItWorks")}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">
            {t("howItWorks")}
          </h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                <Smartphone size={28} />
              </div>
              <h3 className="text-sm font-black text-gray-900">{msg("homeStep1Title", "Book Online")}</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-[220px]">
                {msg("homeStep1Desc", "Choose your dates and bags, complete booking in seconds.")}
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                <QrCode size={28} />
              </div>
              <h3 className="text-sm font-black text-gray-900">{msg("homeStep2Title", "Drop Off")}</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-[220px]">
                {msg("homeStep2Desc", "Go to the shop and show your QR code. Bags are sealed and stored.")}
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                <Map size={28} />
              </div>
              <h3 className="text-sm font-black text-gray-900">{msg("homeStep3Title", "Explore Free")}</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-[220px]">
                {msg("homeStep3Desc", "Enjoy the city hands-free. Pick up your bags anytime before closing.")}
              </p>
            </div>
          </div>
          {/*
            Uc kutucuk NE yapildigini soyluyor; misafirin durduran sorulari
            (kimlik isteniyor mu, valizim acilir mi, gec kalirsam ne olur) bu
            sayfada cevaplaniyor. Emanet guven satan bir hizmet -- cevabi
            olmayan soru rezervasyonu durdurur.
          */}
          <Link
            href="/how-it-works"
            /* `py-2 -my-2`: olculdu 169x20 px; WCAG 2.2 kriteri 2.5.8 en az
               24x24 ister. Gorunum degismiyor, yalnizca tiklanabilir alan. */
            className="mt-10 inline-flex items-center gap-2 py-2 -my-2 text-sm font-bold text-orange-600 hover:text-orange-700"
          >
            {t("howItWorksMore")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/*
        Güven bandı — yalnızca söyleyecek bir şeyi varsa.

        Lansmanda "0 tamamlanan depolama · 0 yorum · — puan" basıyordu: güven
        vermesi gereken şerit tam tersini söylüyordu (2026-08-22 ekran
        görüntüsü). Sıfır olan kutucuk gizlenir; iki kutucuktan az kalırsa
        şerit hiç çizilmez.
      */}
      {(() => {
        const tiles: { value: ReactNode; label: string }[] = [];
        if (stats.activeLocations > 0) {
          tiles.push({ value: nf.format(stats.activeLocations), label: t("trustStatLocations") });
        }
        if (stats.completedStays > 0) {
          tiles.push({ value: nf.format(stats.completedStays), label: t("trustStatStays") });
        }
        if (stats.reviewCount > 0) {
          tiles.push({ value: nf.format(stats.reviewCount), label: t("trustStatReviews") });
        }
        if (stats.averageRating != null && stats.reviewCount > 0) {
          tiles.push({
            value: (
              <>
                {formatDecimal(stats.averageRating, locale)}
                <Star
                  className="inline h-7 w-7 md:h-8 md:w-8 text-orange-500 fill-orange-500"
                  aria-hidden
                />
              </>
            ),
            label: t("trustStatAvgRating"),
          });
        }
        if (tiles.length < 2) return null;
        return (
          <section
            className="border-y border-gray-100 bg-white py-10 px-6"
            aria-label={t("trustStatsAria")}
          >
            <div
              className={`max-w-5xl mx-auto grid grid-cols-2 gap-8 md:gap-6 text-center ${
                tiles.length === 4 ? "md:grid-cols-4" : tiles.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"
              }`}
            >
              {tiles.map((tile) => (
                <div key={tile.label}>
                  <p className="inline-flex items-center gap-1 text-2xl md:text-3xl font-black tabular-nums text-gray-900">
                    {tile.value}
                  </p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {tile.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <section
        className="border-y border-gray-100 bg-gray-50/90 py-14 px-6"
        aria-labelledby="city-hub-heading"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="city-hub-heading"
            className="text-center text-xs font-black uppercase tracking-[0.2em] text-gray-400"
          >
            {t("cityHubTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-gray-500">
            {t("cityHubIntro")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2 md:gap-3">
            {STORAGE_CITIES.map((c) => (
              <Link
                key={c.slug}
                href={`/luggage-storage/${c.slug}`}
                /* `min-w-11` (44px): sehir adi cok kisa olabiliyor ve cip o zaman
                   dokunma hedefi esiginin altina dusuyor. Olculdu: Farsca "رم"
                   (Roma) 21 px genisligindeydi. Uzun isimlerde hicbir sey
                   degismiyor; yalnizca alt sinir kondu. */
                className="min-w-11 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-bold text-gray-800 shadow-sm transition hover:border-orange-200 hover:text-orange-600"
              >
                {tCity(`${c.slug}.label`)}
              </Link>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link
              href="/luggage-storage"
              /* `inline-block py-2 -my-2`: olculdu 202x17 px, WCAG 2.2 kriteri
                 2.5.8 en az 24x24 ister. Gorunum degismiyor. */
              className="inline-block py-2 -my-2 text-sm id-eyebrow text-orange-600 underline-offset-4 hover:underline"
            >
              {t("cityHubViewAll")}
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-gray-900 md:text-4xl">
            {editorialCopy.visualTitle}
          </h2>
          <p className="mt-3 text-base text-gray-500">{editorialCopy.visualBody}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {editorialCopy.visualCards.map((card) => (
            <article
              key={card.title}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div
                className="h-44 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${card.image})` }}
                aria-hidden
              />
              <div className="p-4">
                <h3 className="text-sm font-black text-gray-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{card.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 pb-4">
        <BagProtection variant="landing" insuranceEnabled={insuranceEnabled} />
      </div>

      {/* Trust Features - Minimalist Icons */}
      {/* Sigorta karti P1-20 korumasi altinda: `insuranceFeeTry = 0` iken
          "10.000 TL Sigorta Dahil" karsiligi olmayan bir vaatti (bkz.
          ShopDetailClient/BagProtection, ayni hata sinifi). Kart gizlenince
          3 sutunlu izgarada bos bir hucre kalmasin diye sutun sayisi da
          o zaman 2'ye dusuyor. */}
      <section
        className={`py-20 px-6 max-w-5xl mx-auto w-full grid grid-cols-1 gap-12 text-center text-sm ${
          insuranceEnabled ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {insuranceEnabled ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h4 className="font-bold mb-1">{t('insuranceIncluded')}</h4>
              <p className="text-gray-500 leading-relaxed">{t('trustInsuranceBody')}</p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <MapPin size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">{t('trustNetworkTitle')}</h4>
            <p className="text-gray-500 leading-relaxed">{t('trustNetworkBody')}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <Clock size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">{t('trustSupportTitle')}</h4>
            <p className="text-gray-500 leading-relaxed">{t('trustSupportBody')}</p>
          </div>
        </div>
      </section>

      {/* Rewards + Trust Section */}
      <section className="py-16 px-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-8 text-white shadow-xl shadow-orange-200/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Star size={20} fill="currentColor" />
              </div>
              <h3 className="text-lg font-black">{t('loyaltyRewardsTitle')}</h3>
            </div>
            <p className="text-white/90 text-sm leading-relaxed mb-4">
              {t('loyaltyRewardsBody')}
            </p>
            <Link href="/search" className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-white/30 transition-colors">
              {t('bookNow')}
            </Link>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={24} />
            </div>
            <p className="text-sm text-gray-500 font-medium">{t('trustpilotRatingText')}</p>
            <div className="flex items-center gap-1 id-eyebrow text-gray-400">
              <ShieldCheck size={12} />
              {t('trustVerificationBadge')}
            </div>
          </div>
        </div>
      </section>

      {/* App Download Banner */}
      <section className="py-16 px-6 max-w-5xl mx-auto w-full">
        <div className="rounded-3xl bg-gray-900 p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shrink-0">
            <Smartphone size={28} className="text-gray-900" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-black text-white">{t('appBannerTitle')}</h3>
            <p className="text-gray-400 text-sm mt-1">{t('appBannerBody')}</p>
          </div>
          <Link href="/search" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white px-6 py-3 font-black text-sm transition-colors shrink-0">
            {t('appBannerCta')}
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 pb-16">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 md:p-8">
          <h2 className="text-2xl font-black tracking-tight text-gray-900">
            {editorialCopy.seoTitle}
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600">
            {editorialCopy.seoParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <TestimonialCarousel items={testimonials} />
      <ComparisonTable insuranceEnabled={insuranceEnabled} />
      <PartnerPromoModal />
    </div>
  );
}
