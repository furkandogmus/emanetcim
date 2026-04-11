import { getSiteBaseUrl } from "@/lib/site-urls";

type CityStorageJsonLdInput = {
  locale: string;
  slug: string;
  pageName: string;
  description: string;
  siteName: string;
};

/**
 * Şehir valiz emanet SEO sayfası: WebPage + BreadcrumbList.
 */
export function buildCityStorageJsonLd(input: CityStorageJsonLdInput) {
  const base = getSiteBaseUrl();
  const homeUrl = `${base}/${input.locale}`;
  const pageUrl = `${base}/${input.locale}/luggage-storage/${input.slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: input.pageName,
        description: input.description,
        isPartOf: {
          "@type": "WebSite",
          name: input.siteName,
          url: base,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: input.siteName,
            item: homeUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: input.pageName,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
