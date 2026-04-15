import { getSiteBaseUrl } from "@/lib/site-urls";

export function buildWebPageJsonLd(input: {
  locale: string;
  path: string;
  title: string;
  description: string;
}) {
  const base = getSiteBaseUrl().replace(/\/$/, "");
  const pageUrl = `${base}/${input.locale}${input.path}`;

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": pageUrl,
    url: pageUrl,
    name: input.title,
    description: input.description,
    inLanguage: input.locale,
  };
}

export function buildItemListJsonLd(input: {
  locale: string;
  path: string;
  itemNamePrefix?: string;
  items: Array<{ name: string; urlPath: string }>;
}) {
  const base = getSiteBaseUrl().replace(/\/$/, "");
  const pageUrl = `${base}/${input.locale}${input.path}`;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListOrder: "http://schema.org/ItemListOrderAscending",
    numberOfItems: input.items.length,
    url: pageUrl,
    itemListElement: input.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: input.itemNamePrefix ? `${input.itemNamePrefix} ${item.name}` : item.name,
      url: `${base}/${input.locale}${item.urlPath}`,
    })),
  };
}
