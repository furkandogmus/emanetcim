import { routing } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-base-url";

/** Public paths (locale prefix hariç) — SEO sitemap için. */
export const SITEMAP_PATHS: readonly string[] = [
  "",
  "/search",
  "/blog",
  "/about",
  "/contact",
  "/faq",
  "/partners",
  "/privacy",
  "/terms",
  "/kvkk",
  "/login",
  "/register",
  "/become-partner",
  "/demand",
  "/how-it-works",
  "/hotels",
  "/luggage-storage",
];

/** Govde `src/lib/site-base-url.ts`te; burasi yalnizca mevcut adi koruyor. */
export { getSiteBaseUrl } from "@/lib/site-base-url";

export function buildLocalizedUrls(): { locale: string; path: string; url: string }[] {
  const base = getSiteBaseUrl();
  const out: { locale: string; path: string; url: string }[] = [];
  for (const locale of routing.locales) {
    for (const path of SITEMAP_PATHS) {
      const url = `${base}/${locale}${path === "" ? "" : path}`;
      out.push({ locale, path, url });
    }
  }
  return out;
}
