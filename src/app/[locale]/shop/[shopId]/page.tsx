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
    responseTimeMinutes: shop.responseTimeMinutes,
    reviews: shop.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      authorLabel:
        r.guest?.name?.trim()?.split(/\s+/)[0] ?? "",
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
      />
    </>
  );
}
