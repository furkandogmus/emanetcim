/** Open Graph locale (BCP 47 + region) */
export function openGraphLocaleForUiLocale(locale: string): string {
  const map: Record<string, string> = {
    tr: "tr_TR",
    en: "en_US",
    de: "de_DE",
    fr: "fr_FR",
    ja: "ja_JP",
    fa: "fa_IR",
  };
  return map[locale] ?? "en_US";
}
