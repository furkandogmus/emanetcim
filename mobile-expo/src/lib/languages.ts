/**
 * Uygulamanin dilleri ve her birinin Intl / web karsiligi. Ekranlar dil kararini
 * buradan alir; `i18n.language === "tr" ? ... : ...` yeni bir dil eklendiginde
 * Almanca kullaniciya Ingilizce tarih gosteriyordu.
 */
export const APP_LANGUAGES = [
  // Ad her zaman kendi dilinde: Turkce bilmeyen "Deutsch"u bulabilmeli.
  { value: "tr", label: "Türkçe", intl: "tr-TR", site: "tr" },
  { value: "en", label: "English", intl: "en-GB", site: "en" },
  { value: "de", label: "Deutsch", intl: "de-DE", site: "de" },
  // Web ve e-posta Rusca tasimiyor: site baglantilari ve sunucu Ingilizceye duser.
  { value: "ru", label: "Русский", intl: "ru-RU", site: "en" },
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number]["value"];

export function isAppLanguage(v: unknown): v is AppLanguage {
  return APP_LANGUAGES.some((l) => l.value === v);
}

/** Bilinmeyen dil Ingilizceye duser: Turkce bilmeyen biri icin daha okunur. */
export function languageInfo(lang: string) {
  return APP_LANGUAGES.find((l) => l.value === lang) ?? APP_LANGUAGES[1];
}
