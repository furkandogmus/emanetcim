import { getSiteBaseUrl } from "@/lib/site-urls";
import type { HubShop } from "@/lib/transit-hub-shops";

/**
 * Yer sayfasindaki GERCEK dukkanlarin listesi. Puan, fiyat ve saat bilerek
 * yok: bunlar dukkan sayfasinin kendi LocalBusiness kaydinda, tek kaynaktan.
 */
export function buildHubShopsItemListJsonLd(input: {
  locale: string;
  path: string;
  name: string;
  shops: readonly HubShop[];
}): Record<string, unknown> {
  const base = getSiteBaseUrl().replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: `${base}/${input.locale}${input.path}`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: input.shops.length,
    itemListElement: input.shops.map((shop, i) => {
      const item: Record<string, unknown> = {
        "@type": "LocalBusiness",
        name: shop.name,
        url: `${base}/${input.locale}/shop/${shop.id}`,
        geo: { "@type": "GeoCoordinates", latitude: shop.latitude, longitude: shop.longitude },
      };
      if (shop.address?.trim()) {
        item.address = { "@type": "PostalAddress", streetAddress: shop.address.trim() };
      }
      return { "@type": "ListItem", position: i + 1, item };
    }),
  };
}
