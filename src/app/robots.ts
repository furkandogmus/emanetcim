import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-urls";

// Build sırasında değil istek anında üret: NEXT_PUBLIC_BASE_URL build env'inde
// yoksa sitemap satırı localhost'a düşüyordu (canlıda görülen hata).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();
  const disallow = [
    "/api/",
    ...routing.locales.flatMap((locale) => [
      `/${locale}/admin`,
      `/${locale}/partner`,
      `/${locale}/bookings`,
      `/${locale}/checkout`,
      `/${locale}/account`,
      `/${locale}/auth`,
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
