import { APP_LOCALES, DEFAULT_APP_LOCALE, type AppLocale } from "@/i18n/locales";

/**
 * `/r/<kod>?to=` hedefi: YALNIZCA site ici yol. `//evil.com`, `/\evil.com`,
 * `https://...`, kontrol karakteri ve `..` reddedilir (acik yonlendirme olmasin);
 * reddedilen ya da bos hedef o dilin ana sayfasidir. Dil oneki yoksa eklenir.
 */
export function safeAffiliateRedirectPath(to: string | null | undefined, locale: string): string {
  const lang: AppLocale = (APP_LOCALES as readonly string[]).includes(locale) ? (locale as AppLocale) : DEFAULT_APP_LOCALE;
  const home = `/${lang}`;
  if (!to) return home;
  if (to.length > 512) return home;
  if (!to.startsWith("/") || to.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(to)) return home;
  let parsed: URL;
  try {
    parsed = new URL(to, "https://internal.invalid");
  } catch {
    return home;
  }
  if (parsed.origin !== "https://internal.invalid") return home;
  if (parsed.pathname.split("/").some((seg) => seg === "..")) return home;
  const path = parsed.pathname + parsed.search + parsed.hash;
  const first = parsed.pathname.split("/")[1] ?? "";
  if ((APP_LOCALES as readonly string[]).includes(first)) return path;
  return `${home}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}${parsed.hash}`;
}
