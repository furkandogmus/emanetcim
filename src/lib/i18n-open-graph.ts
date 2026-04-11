/** Open Graph locale (BCP 47 + region) */
export function openGraphLocaleForUiLocale(locale: string): string {
  const map: Record<string, string> = {
    tr: "tr_TR",
    en: "en_US",
    de: "de_DE",
    fr: "fr_FR",
    es: "es_ES",
    it: "it_IT",
    zh: "zh_CN",
    ja: "ja_JP",
    ar: "ar_SA",
    ko: "ko_KR",
    ru: "ru_RU",
    fa: "fa_IR",
    bg: "bg_BG",
    pl: "pl_PL",
  };
  return map[locale] ?? "en_US";
}
