import type { ShopPublicDetail } from "@/services/ShopService";
import { getSiteBaseUrl } from "@/lib/site-urls";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * Mağaza detay sayfası için schema.org LocalBusiness (SEO zengin sonuç).
 */
export function buildShopLocalBusinessJsonLd(
  shop: ShopPublicDetail,
  locale: string,
): Record<string, unknown> {
  const base = getSiteBaseUrl();
  const url = `${base}/${locale}/shop/${shop.id}`;

  let openingHoursSpecification: unknown;
  if (shop.open247) {
    openingHoursSpecification = WEEKDAYS.map((day) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: day,
      opens: "00:00",
      closes: "23:59",
    }));
  } else if (shop.openingTime && shop.closingTime) {
    openingHoursSpecification = WEEKDAYS.map((day) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: day,
      opens: shop.openingTime,
      closes: shop.closingTime,
    }));
  }

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: shop.name,
    url,
  };

  if (shop.address?.trim()) {
    ld.description = shop.address.trim();
    ld.address = {
      "@type": "PostalAddress",
      streetAddress: shop.address.trim(),
    };
  }

  if (shop.latitude != null && shop.longitude != null) {
    ld.geo = {
      "@type": "GeoCoordinates",
      latitude: shop.latitude,
      longitude: shop.longitude,
    };
  }

  if (openingHoursSpecification) {
    ld.openingHoursSpecification = openingHoursSpecification;
  }

  if (
    shop.rating != null &&
    shop.rating > 0 &&
    shop.reviews.length > 0
  ) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: shop.rating,
      reviewCount: shop.reviews.length,
    };
  }

  return ld;
}
