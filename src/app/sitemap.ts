import type { MetadataRoute } from "next";
import { buildLocalizedUrls, getSiteBaseUrl } from "@/lib/site-urls";
import prisma from "@/lib/db";
import { routing } from "@/i18n/routing";

/**
 * Dynamic Sitemap - Statik sayfalar + Tüm Aktif Dükkanlar
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base = getSiteBaseUrl();

  // 1. Statik Lokalize Sayfalar
  const staticPages = buildLocalizedUrls().map(({ url, path }) => {
    const isHome = path === "";
    return {
      url,
      lastModified: now,
      changeFrequency: isHome ? "daily" : "weekly",
      priority: isHome ? 1 : path === "/search" ? 0.9 : 0.7,
    } satisfies MetadataRoute.Sitemap[number];
  });

  // 2. Dinamik Dükkan Sayfaları (Checkout Akışı)
  // Gelecekte dükkan detay sayfaları açılırsa buralar güncellenebilir.
  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    select: { id: true, updatedAt: true },
  });

  const shopEntries: MetadataRoute.Sitemap = [];
  
  for (const shop of shops) {
    for (const locale of routing.locales) {
      shopEntries.push({
        url: `${base}/${locale}/checkout/${shop.id}`,
        lastModified: shop.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return [...staticPages, ...shopEntries];
}
