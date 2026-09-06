import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
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
        className={`${geistSans.variable} flex min-h-screen flex-col bg-gray-50 antialiased selection:bg-orange-100 selection:text-orange-900`}
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
            <VerificationBanner />
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
            >
              {/*
                Sabit Türkçeydi. Bu bağlantı her sayfadaki İLK sekme durağı:
                klavye/ekran okuyucu kullanan Japon bir misafir Türkçe duyuyordu.
              */}
              {tCommon("skipToContent")}
            </a>
            <Header />
            <main id="main-content" className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
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
