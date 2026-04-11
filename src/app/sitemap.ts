import type { MetadataRoute } from "next";
import { buildLocalizedUrls, getSiteBaseUrl } from "@/lib/site-urls";
import prisma from "@/lib/db";
import { routing } from "@/i18n/routing";
import { STORAGE_CITIES } from "@/lib/storage-cities";

export const dynamic = 'force-dynamic';

/**
 * Dynamic Sitemap - Statik sayfalar + Tüm Aktif Dükkanlar
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base = getSiteBaseUrl();

  // 1. Statik Lokalize Sayfalar
  const staticPages = buildLocalizedUrls().map(({ url, path, locale }) => {
    const isHome = path === "";
    const homePriority = locale === routing.defaultLocale ? 1 : 0.92;
    return {
      url,
      lastModified: now,
      changeFrequency: isHome ? "daily" : "weekly",
      priority: isHome ? homePriority : path === "/search" ? 0.9 : 0.7,
    } satisfies MetadataRoute.Sitemap[number];
  });

  const cityStorageEntries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    for (const c of STORAGE_CITIES) {
      cityStorageEntries.push({
        url: `${base}/${locale}/luggage-storage/${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
  }

  const shopEntries: MetadataRoute.Sitemap = [];
  try {
    // 2. Dinamik Dükkan Sayfaları (Checkout Akışı)
    const shops = await prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    });

    for (const shop of shops) {
      for (const locale of routing.locales) {
        shopEntries.push({
          url: `${base}/${locale}/shop/${shop.id}`,
          lastModified: shop.updatedAt,
          changeFrequency: "weekly",
          priority: 0.68,
        });
        shopEntries.push({
          url: `${base}/${locale}/checkout/${shop.id}`,
          lastModified: shop.updatedAt,
          changeFrequency: "weekly",
          priority: 0.52,
        });
      }
    }
  } catch (error) {
    console.error("Sitemap generation error (Shops):", error);
    // Build sırasında veritabanı erişilemiyorsa sadece statik sayfalarla devam et
  }

  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    // 3. Dinamik Blog Yazıları
    const blogPosts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { slug: true, locale: true, updatedAt: true },
    });

    blogEntries = blogPosts.map((post) => ({
      url: `${base}/${post.locale}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch (error) {
    console.error("Sitemap generation error (Blog):", error);
  }

  return [...staticPages, ...cityStorageEntries, ...shopEntries, ...blogEntries];
}
