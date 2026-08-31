import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { shopService } from "@/services/ShopService";
import ShopDetailClient from "@/components/guest/ShopDetailClient";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { buildShopLocalBusinessJsonLd } from "@/lib/shop-json-ld";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-json-ld";
import { routing } from "@/i18n/routing";
import { auth } from "@/auth";
import { analyticsService } from "@/services/AnalyticsService";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";
import { resolveServerSessionId } from "@/lib/analytics-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}): Promise<Metadata> {
  const { locale, shopId } = await params;
  const shop = await shopService.getShopDetails(shopId);
  const t = await getTranslations({ locale, namespace: "Guest" });
  if (!shop || !shop.isActive) {
    return { title: t("shopDetailNotFoundTitle") };
  }
  const base = getSiteBaseUrl();
  const title = `${shop.name} — ${t("shopDetailTitleSuffix")}`;
  const description = shop.address ?? t("shopDetailMetaFallback");
  const canonical = `${base}/${locale}/shop/${shopId}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = `${base}/${loc}/shop/${shopId}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}/shop/${shopId}`;
  return {
    title,
    description,
    /*
      Talep testi noktasi DIZINE GIRMEZ, ama baglantilari izlenir.

      Bu sayfa rezervasyon almiyor ve 482 tanesi neredeyse ayni. Aramadan gelen
      bir ziyaretci burada aradigini bulamaz -- yani hem kotu bir kullanici
      deneyimi hem de arama motoruna kotu bir kalite sinyali. `follow` kaliyor
      ki sayfadaki gercek baglantilar (talep haritasi, esnaf basvurusu)
      taranabilsin.

      Nokta hizmete acildiginda `isPrelaunch` false olur ve sayfa kendiliginden
      dizine acilir; ayrica bir sey yapmak gerekmiyor.
    */
    ...(shop.isPrelaunch ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}) {
  const { locale, shopId } = await params;
  setRequestLocale(locale);

  const shop = await shopService.getShopPublicDetail(shopId);
  if (!shop) {
    notFound();
  }

  const session = await auth();
  analyticsService.track({
    name: "shop_view",
    sessionId: await resolveServerSessionId(session?.user?.id),
    userId: session?.user?.id ?? null,
    locale,
    metadata: { shopId: shop.id },
  });

  const shopImages = await shopService.getShopImages(shopId).catch(() => []);
  /*
    Talep testi noktasinda "kac kisi burayi istiyor" sayisi SUNUCUDA okunur:
    misafir sayfayi actigi anda gormeli, tiklamayi beklememeli -- gorunen sayi
    tiklamanin kendisini tesvik eden seyin ta kendisi. Isletilen dukkanlarda
    sorgu hic calismaz.
  */
  const prelaunchWantCount = shop.isPrelaunch
    ? await prelaunchInterestService.wantCount(shopId).catch(() => 0)
    : 0;

  const pricingRules = await getPricingRules();

  const jsonLd = buildShopLocalBusinessJsonLd(shop, locale);
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: tCommon("mobileNavHome"), path: `/${locale}` },
    { name: tCommon("mobileNavSearch"), path: `/${locale}/search` },
    { name: shop.name, path: `/${locale}/shop/${shop.id}` },
  ]);

  const clientShop = {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    image: shop.image,
    description: shop.description,
    latitude: shop.latitude,
    longitude: shop.longitude,
    capacity: shop.capacity,
    rating: shop.rating,
    pricePerDay: moneyToNumber(shop.pricePerDay),
    hasRestroom: shop.hasRestroom,
    hasCctv: shop.hasCctv,
    hasClimateControl: shop.hasClimateControl,
    acceptsLargeItems: shop.acceptsLargeItems,
    open247: shop.open247,
    openingTime: shop.openingTime,
    closingTime: shop.closingTime,
    isVerified: shop.isVerified,
    isPrelaunch: shop.isPrelaunch,
    responseTimeMinutes: shop.responseTimeMinutes,
    reviews: shop.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      authorLabel:
        r.guest?.name?.trim()?.split(/\s+/)[0] ?? "",
    })),
    images: shopImages.map((img) => ({
      id: img.id,
      url: img.url,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ShopDetailClient
        shop={clientShop}
        pricingRules={JSON.parse(JSON.stringify(pricingRules))}
        prelaunchWantCount={prelaunchWantCount}
      />
    </>
  );
}
