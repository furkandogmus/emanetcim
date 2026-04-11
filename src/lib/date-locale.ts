/** `toLocaleString` / `Intl` BCP 47 tag from app UI locale */
export function dateLocaleForUiLocale(locale: string): string {
  if (locale === "tr") return "tr-TR";
  if (locale === "ar") return "ar";
  if (locale === "ko") return "ko-KR";
  if (locale === "ru") return "ru-RU";
  if (locale === "fa") return "fa-IR";
  if (locale === "bg") return "bg-BG";
  if (locale === "pl") return "pl-PL";
  return "en-US";
}
