import { getSiteBaseUrl } from "@/lib/site-urls";

export type BreadcrumbSegment = { name: string; path: string };

/**
 * schema.org BreadcrumbList — path mutlak yol (/tr/search gibi, sorgu yok).
 */
export function buildBreadcrumbJsonLd(
  segments: BreadcrumbSegment[],
): Record<string, unknown> {
  const base = getSiteBaseUrl().replace(/\/$/, "");
  const itemListElement = segments.map((seg, i) => {
    const path = seg.path.startsWith("/") ? seg.path : `/${seg.path}`;
    return {
      "@type": "ListItem",
      position: i + 1,
      name: seg.name,
      item: `${base}${path}`,
    };
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}
