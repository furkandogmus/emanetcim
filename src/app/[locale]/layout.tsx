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

export const metadata: Metadata = {
  metadataBase: new URL("https://bagajpark.com"),
  title: {
    template: "%s | BagajPark",
    default: "BagajPark | Valizini Güvenle Bırak, Özgürce Gez",
  },
  description: "Türkiye'nin en yaygın ve güvenilir yerel emanet ağı. Valizini güvenli noktalara bırak, şehri yüklerin olmadan keşfet.",
  keywords: ["valiz emanet", "bagaj bırakma", "istanbul luggage storage", "bagajpark", "emanet noktası", "güvenli bagaj", "esnaf emanet"],
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "BagajPark", url: "https://bagajpark.com" }],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://bagajpark.com",
    siteName: "BagajPark",
    title: "BagajPark | Valizini Güvenle Bırak, Özgürce Gez",
    description: "Türkiye'nin en yaygın ve güvenilir emanet noktası ağı.",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "BagajPark - Güvenli Bagaj Ağı",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BagajPark | Valizini Güvenle Bırak",
    description: "Türkiye'nin emanet noktası ağı.",
    images: ["/icons/icon-512x512.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BagajPark",
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

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

  const messages = await getMessages();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BagajPark",
    "url": "https://bagajpark.com",
    "description": "Türkiye'nin en yaygın ve güvenilir emanet noktası ağı.",
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
