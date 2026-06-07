import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { openGraphLocaleForUiLocale } from "@/lib/i18n-open-graph";
import PWARegister from "@/components/PWARegister";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { Providers } from "@/components/Providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileNav from "@/components/layout/MobileNav";
import CookieConsent from "@/components/CookieConsent";
import ConsentAwareAnalytics from "@/components/ConsentAwareAnalytics";
import CrispChat from "@/components/CrispChat";
import SentryClientInit from "@/components/SentryClientInit";
import VerificationBanner from "@/components/layout/VerificationBanner";
import { config } from "@/lib/config";

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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SEO" });
  const { setRequestLocale } = await import("next-intl/server");
  setRequestLocale(locale);

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
    manifest: "/manifest.json",
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
  const messages = await getMessages();
  const base = getSiteBaseUrl();

  const htmlLang = locale === "zh" ? "zh-Hans" : locale;
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
      lang={locale === "zh" ? "zh-Hans" : locale}
      dir={locale === "ar" || locale === "fa" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} bg-gray-50 antialiased selection:bg-orange-100 selection:text-orange-900`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
        />
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <PWARegister />
            <VerificationBanner />
            <Header />
            <main className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
              {children}
            </main>
            <Footer />
            <PWAInstallBanner />
            <MobileNav />
            <CookieConsent />
            <SentryClientInit />
            <ConsentAwareAnalytics />
            <CrispChat />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
