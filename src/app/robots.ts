import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-urls";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();
  const disallow = [
    "/api/",
    ...routing.locales.flatMap((locale) => [
      `/${locale}/admin`,
      `/${locale}/partner`,
      `/${locale}/bookings`,
      `/${locale}/checkout`,
    ]),
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
