import type { MetadataRoute } from "next";
import { buildLocalizedUrls } from "@/lib/site-urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return buildLocalizedUrls().map(({ url, path }) => {
    const isHome = path === "";
    return {
      url,
      lastModified: now,
      changeFrequency: isHome ? "daily" : "weekly",
      priority: isHome ? 1 : path === "/search" ? 0.9 : 0.7,
    } satisfies MetadataRoute.Sitemap[number];
  });
}
