import { routing } from "@/i18n/routing";

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
];

export function getSiteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

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
