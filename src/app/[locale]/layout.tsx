import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SEO" });

  return {
    metadataBase: new URL("https://bagajpark.com"),
    title: {
      template: "%s | BagajPark",
      default: t("title"),
    },
    description: t("description"),
    keywords: t("keywords").split(",").map(k => k.trim()),
    alternates: {
      canonical: "/",
      languages: {
        "tr": "/tr",
        "en": "/en",
      },
    },
    authors: [{ name: "BagajPark", url: "https://bagajpark.com" }],
    openGraph: {
      type: "website",
      locale: locale === "tr" ? "tr_TR" : "en_US",
      url: `https://bagajpark.com/${locale}`,
      siteName: "BagajPark",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: [
        {
          url: "/icons/icon-512x512.png",
          width: 512,
          height: 512,
          alt: "BagajPark",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/icons/icon-512x512.png"],
    },
    manifest: "/manifest.json",
  };
}

import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import PWARegister from '@/components/PWARegister';
import { Providers } from "@/components/Providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CookieConsent from "@/components/CookieConsent";
import VerificationBanner from "@/components/layout/VerificationBanner";

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const tSEO = await getTranslations({ locale, namespace: "SEO" });
  const messages = await getMessages();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BagajPark",
    "url": "https://bagajpark.com",
    "description": tSEO("description"),
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://bagajpark.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "BagajPark",
    "url": "https://bagajpark.com",
    "logo": "https://bagajpark.com/icons/icon-512x512.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+90-542-241-55-97",
      "contactType": "customer service",
      "availableLanguage": ["Turkish", "English"]
    }
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} bg-gray-50 antialiased selection:bg-orange-100 selection:text-orange-900`}
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
            <main className="min-h-screen">
              {children}
            </main>
            <Footer />
            <CookieConsent />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
