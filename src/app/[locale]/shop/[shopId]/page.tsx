import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { shopService } from "@/services/ShopService";
import ShopDetailClient from "@/components/guest/ShopDetailClient";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";

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
  return {
    title: `${shop.name} — ${t("shopDetailTitleSuffix")}`,
    description: shop.address ?? t("shopDetailMetaFallback"),
    alternates: {
      canonical: `${base}/${locale}/shop/${shopId}`,
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

  const clientShop = {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    latitude: shop.latitude,
    longitude: shop.longitude,
    capacity: shop.capacity,
    rating: shop.rating,
    pricePerDay: moneyToNumber(shop.pricePerDay),
    hasRestroom: shop.hasRestroom,
    open247: shop.open247,
    openingTime: shop.openingTime,
    closingTime: shop.closingTime,
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
    <ShopDetailClient
      shop={clientShop}
      pricingRules={JSON.parse(JSON.stringify(pricingRules))}
    />
  );
}
