import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-urls";

/**
 * Çok dilli sayfalar için canonical + hreflang (x-default = varsayılan dil).
 * `path` locale önekisiz, örn. "" (ana sayfa), "/search", "/about".
 */
export function alternatesForPath(locale: string, path: string): Metadata["alternates"] {
  const base = getSiteBaseUrl();
  const suffix = path === "" ? "" : path;
  const canonical = `${base}/${locale}${suffix}`;
  const languages = Object.fromEntries([
    ...routing.locales.map((loc) => [loc, `${base}/${loc}${suffix}`] as const),
    ["x-default", `${base}/${routing.defaultLocale}${suffix}`] as const,
  ]);
  return { canonical, languages };
}
