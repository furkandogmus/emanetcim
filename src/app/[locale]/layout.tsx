import type { Metadata, Viewport } from "next";
import { Geist, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { siteIdentityAttribute } from "@/lib/site-identity";
import { openGraphLocaleForUiLocale } from "@/lib/i18n-open-graph";
import PWARegister from "@/components/PWARegister";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { Providers } from "@/components/Providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileNav from "@/components/layout/MobileNav";
import CookieConsent from "@/components/CookieConsent";
import ConsentAwareAnalytics from "@/components/ConsentAwareAnalytics";
import AnalyticsPageView from "@/components/AnalyticsPageView";
import CrispChat from "@/components/CrispChat";
import VerificationBanner from "@/components/layout/VerificationBanner";
import { config } from "@/lib/config";
import { resolveCommerceContext } from "@/lib/commerce-context";
import { CommerceProvider } from "@/components/providers/CommerceProvider";
import { serializeJsonLd } from "@/lib/json-ld-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/**
 * BASLIK AILESI — Bricolage Grotesque (2026-09-12).
 *
 * NEDEN AYRI BIR AILE: site bugune kadar TEK yazi tipi kullaniyordu, Geist —
 * `create-next-app`in kutudan cikan fontu. Ustune baslik agirligi `font-black`
 * (900) idi, yani sayfa hem varsayilan hem en yuksek sesindeydi. Bir yazi
 * tipinin karakteri yoksa kalinlik onu yerine koymaz, yalnizca bagirir.
 *
 * NEDEN BU AILE: Bricolage bilerek DUZENSIZ bir grotesk — harfler birbirinin
 * tipatip klonu degil, tabela ve el yapimi bir dokusu var. Urunun kendisi bu:
 * depo zinciri degil, kose dukkani. Bir kuruyemisci, bir berber, bir eczane.
 * Geist'in notr Isvicre tonu o sokagin degil, bir kontrol panelinin sesi.
 *
 * `opsz` (optik boyut) ve `wdth` (genislik) eksenleri BILEREK isteniyor:
 * `globals.css` basligi buyudukce `opsz`i yukseltiyor, harfler siklasiyor ve
 * bosluklar kapaniyor -- degisken fontun asil isi bu, ve tek bir dosya
 * indirilerek yapiliyor.
 *
 * `latin-ext` Turkce (g, s, i, I, o, u) VE Almanca/Fransizca/Lehce
 * karakterlerini tasir. Japonca ve Farsca bu ailede YOK; o iki dilde baslik
 * sistem fontuna duser — dogrusu da bu, cunku eksik glif taklidi bir font
 * ikamesi o dillerde okunakli degil ucube uretir.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
};

/**
 * `[locale]` segmenti hicbir yerde `generateStaticParams` tanimlamiyordu --
 * Next.js hangi locale degerlerinin gecerli oldugunu bilmedigi icin TUM
 * `[locale]/*` agacini (ozel/kisisel sayfalar disinda) varsayilan olarak tam
 * dinamik (her istekte sunucuda, cache'lenemez) render ediyordu (2026-09-06'da
 * olculdu: sifir bagimliligi olan bos bir test sayfasi bile `ƒ Dynamic`
 * cikiyordu). Bu satir eklenince ana sayfa + ~20 misafir sayfasi her dil icin
 * statik/ISR uretime giriyor (dogrulandi: gercek DB'ye karsi build, 6 locale
 * icin `● SSG`); oturum/kisisel sayfalar (account, bookings, admin, partner,
 * checkout, shop) Next'in kendi Dynamic API tespiti sayesinde dokunulmadan
 * dinamik kaliyor -- `auth()`/`cookies()` kullanan her yer otomatik hariç
 * tutuluyor.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { setRequestLocale } = await import("next-intl/server");
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "SEO" });

  const baseUrl = getSiteBaseUrl();
  let metadataBase: URL;
  try {
    metadataBase = new URL(baseUrl);
  } catch {
    metadataBase = new URL("https://bagajpark.com");
  }

  return {
    metadataBase,
    title: {
      template: "%s | BagajPark",
      default: t("title"),
    },
    description: t("description"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
    authors: [{ name: "BagajPark", url: baseUrl }],
    openGraph: {
      type: "website",
      locale: openGraphLocaleForUiLocale(locale),
      url: `${baseUrl.replace(/\/$/, "")}/${locale}`,
      siteName: "BagajPark",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "BagajPark",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: [`${baseUrl.replace(/\/$/, "")}/og-image.png`],
    },
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : undefined,
    manifest: "/manifest.json",
    /*
      APPLE TOUCH IKONU BILDIRILIYOR.

      `src/app/favicon.ico` dosya kuralindan otomatik baglaniyor, ama iOS
      bildirilmemis `apple-touch-icon`u KOK DIZINDEN kendisi ister ve 404
      alirdi. Sitede zaten duran PWA ikonuna isaret ediyoruz; yeni dosya
      uretmeye gerek yok.

      `icon` BILINCLI OLARAK YAZILMIYOR: onu dosya kurali (`favicon.ico`)
      saglıyor, burada tekrar tanimlamak iki ayri kaynak demek olurdu.
    */
    icons: {
      apple: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: "BagajPark",
      statusBarStyle: "default",
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const { setRequestLocale } = await import("next-intl/server");
  setRequestLocale(locale);

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const tSEO = await getTranslations({ locale, namespace: "SEO" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const messages = await getMessages();
  /**
   * Ödeme modu: ortam değişkeninden türer, VERİTABANINA DOKUNMAZ.
   * Kök layout'un DB sorgusu yapması hem her istekte bir tur demekti hem de
   * içerik sayfalarının statik üretilmesini engelliyordu — bkz.
   * `src/lib/commerce-context.ts`.
   */
  const commerce = resolveCommerceContext();
  const base = getSiteBaseUrl();

  const htmlLang = locale;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BagajPark",
    "url": `${base}/${locale}`,
    "inLanguage": htmlLang,
    "description": tSEO("description"),
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${base}/${locale}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": config.branding.name,
    "alternateName": config.branding.alternateNames,
    "url": base,
    "logo": `${base}${config.branding.logo}`,
    "areaServed": {
      "@type": "Country",
      name: "Turkey",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: config.contact.phone,
      contactType: "customer service",
      availableLanguage: ["Turkish", "English"],
    },
  };

  return (
    <html
      lang={locale}
      dir={locale === "fa" ? "rtl" : "ltr"}
      /*
        Görsel kimlik anahtarı. Yokken bugünkü görünüm; `ticket`/`seal`/`shop`
        değerlerinde `globals.css`'teki ilgili blok devreye girer. Tek öznitelik
        — geri almak da tek satır. Ayrıntı: `src/lib/site-identity.ts`
      */
      {...siteIdentityAttribute()}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${bricolage.variable} flex min-h-screen flex-col bg-gray-50 antialiased selection:bg-orange-100 selection:text-orange-900`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(orgLd) }}
        />
        <NextIntlClientProvider messages={messages}>
          {/*
            Ticari vaatler (ödeme modu, sigorta) SUNUCUDA çözülüp istemciye
            geçiriliyor. Public env ile ikinci bir doğruluk kaynağı yaratmak
            bilerek reddedildi — bir metnin doğru olup olmadığı, hangi katmandan
            bakıldığına göre değişmemeli (P1-19, P1-20).
          */}
          <CommerceProvider value={commerce}>
          <Providers>
            <PWARegister />
            {/*
              ATLAMA BAGLANTISI YAPISKAN YIGININ ONUNDE.

              Olculdu (2026-09-12, 1440x900): yigin kapsayicisi eklendikten
              sonra ilk `Tab` bu baglantiya degil header'in logosuna
              ({x:25, y:21, w:127}) gidiyordu -- cunku `Header` DOM'da one
              gecmisti. Baglantinin tek isi ILK sekme duragi olmak; belge
              sirasinda basligin onunde durmasi gerekiyor.
            */}
            <a
              href="#main-content"
              /*
                `focus:z-[70]` — onceden `focus:z-50` idi. Olculdu (2026-09-12):
                odaklaninca baglanti {top:16, left:16} noktasinda ciziliyor ama
                `document.elementFromPoint` onu degil header'in logosunu
                donduruyordu; baglanti yapiskan basligin ALTINDA kaliyordu.
                Yigin baglami body oldugu icin z-50'lik kapsayiciyla esit olmak
                yetmez -- DOM'da once geldiginden beraberlikte kaybediyor.
                70, hem kapsayicinin (50) hem eski banner degerinin (60) ustu:
                her sayfadaki ILK sekme duragi artik gercekten gorunuyor.
              */
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:px-4 focus:py-2 focus:bg-orange-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
            >
              {/*
                Sabit Türkçeydi. Bu bağlantı her sayfadaki İLK sekme durağı:
                klavye/ekran okuyucu kullanan Japon bir misafir Türkçe duyuyordu.
              */}
              {tCommon("skipToContent")}
            </a>
            {/*
              TEK YAPISKAN KAPSAYICI.

              Olculdu (2026-09-12, 1440x900): `VerificationBanner` {y:0, h:51,
              z:60} ve `Header` {y:0, h:74, z:50} AYRI AYRI `sticky top-0`
              tasiyordu ve ikisi de `body`nin dogrudan flex cocuguydu. Iki kardes
              ayni `top-0` esigine yapisinca ust uste biniyor: banner, header'in
              74 px'inin 51 px'ini ortuyordu -- yani dogrulanmamis e-posta ile
              gezen bir kullanicinin logosu ve gezinme baglantilari kayboluyordu.
              `sticky` kardesler arasinda sira kurmaz, her biri kendi
              kaydirma kapsayicisina gore yapisir.

              Cozum diziyi DIKEY yigin yapip yigini yapistirmak: ikisi normal
              akista alt alta kalir, kapsayici tek parca olarak tepede durur.
              Bu yuzden ikisinden de `sticky top-0 z-*` KALDIRILDI; z sirasi
              artik burada, tek yerde.
            */}
            <div className="sticky top-0 z-50">
              <VerificationBanner />
              <Header />
            </div>
            {/*
              `--consent-h`: cerez seridinin OLCULEN yuksekligi (bkz.
              `CookieConsent.tsx`, ResizeObserver). Serit `fixed bottom-0
              z-[100]` ile ciziliyordu ve hicbir yer o yuksekligi rezerve
              etmiyordu: olculdu (2026-09-12, 1440x900) her goruntu alaninin ALT
              121 px'i kaliciyla ortuluydu -- ana sayfada "Nasil calisir"
              adimlarinin uzerine biniyordu. Serit yokken degisken tanimsiz
              kalir ve `var(--consent-h,0px)` sifire duser, yani eski davranis
              aynen korunur.

              Telefonda serit `MobileNav`in USTUNDE duruyor, o yuzden iki
              rezervasyon toplanir; `md`den itibaren `MobileNav` yok, geriye
              yalnizca serit kalir.
            */}
            <main
              id="main-content"
              /*
                Sinif listesi BILEREK satirlara bolundu: `hardcoded-copy`
                taramasi bir satirda iki `var(` gorunce onu Turkce cumle
                sayiyor (`\bvar\b` durak kelimesi, iki eslesme = isaretle) ve
                mandal kirmizi yaniyordu. Her satirda tek `var(` kalinca hem
                tarama dogru calisiyor hem de hangi dolgunun hangi kirilima ait
                oldugu okunuyor.
              */
              className={[
                "flex-1",
                // Telefon: alt gezinme cubugu (5rem + guvenli alan) USTUNE serit.
                "pb-[calc(5rem+env(safe-area-inset-bottom)+var(--consent-h,0px))]",
                // md ve ustu: alt gezinme cubugu yok, yalnizca serit.
                "md:pb-[var(--consent-h,0px)]",
              ].join(" ")}
            >
              {children}
            </main>
            <Footer />
            <PWAInstallBanner />
            <MobileNav />
            <CookieConsent />
            <ConsentAwareAnalytics />
            <AnalyticsPageView />
            <CrispChat />
          </Providers>
          </CommerceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
