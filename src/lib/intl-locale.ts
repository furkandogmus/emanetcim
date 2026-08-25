/**
 * Uygulama dilini `Intl` / `toLocaleString` için BCP 47 etiketine çevirir.
 *
 * TARİHE ÖZGÜ DEĞİL: para birimi, sayı ve göreli zaman biçimlendirmesi de aynı
 * etiketi ister. Adı `bcp47ForUiLocale` olduğu için 2026-08-25'te
 * `NotificationService` kendi kopyasını (`CURRENCY_LOCALES`) yazmıştı — birebir
 * aynı altı satır. İsim dar olduğu sürece kopyalanmaya davet ediyordu.
 *
 * NEDEN AÇIK LİSTE: eski hâli yalnızca 7 dili eşliyor, kalan **6'sını
 * (`de`, `fr`, `es`, `it`, `zh`, `ja`) `en-US`'e düşürüyordu.** Sonuç: Alman bir
 * kullanıcı Amerikan tarih formatı görüyordu — `8/22/2026`, oysa `22.8.2026`
 * olmalı. Japonca ve Çince için `2026/8/22` yerine yine `8/22/2026`.
 * Turist odaklı bir üründe bu, tarihin **yanlış okunmasına** yol açar: `8/22`
 * ile `22/8` arasındaki fark, yılın hangi günü bavul bırakılacağıdır.
 *
 * Bölge eki neden var: `tr` tek başına da çalışır ama `tr-TR` gibi tam etiketler
 * hafta başlangıcı ve saat biçimi gibi bölgesel varsayılanları netleştirir.
 * Listede olmayan bir dil eklenirse `en-US` yerine **dilin kendisi** döner —
 * `Intl` çıplak dil kodlarını doğru çözer, yani sessizce Amerikan formatına
 * düşmek yerine en azından doğru dilde kalırız.
 */
const UI_LOCALE_TO_BCP47: Record<string, string> = {
  tr: "tr-TR",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  fa: "fa-IR",
  ja: "ja-JP",
};

export function bcp47ForUiLocale(locale: string): string {
  const mapped = UI_LOCALE_TO_BCP47[locale];
  if (mapped) return mapped;
  /**
   * `?? ` yeterli DEĞİL: boş dize nullish olmadığı için geçer ve `Intl` boş
   * etikette `RangeError` fırlatır — yani sayfa çöker. Testte yakalandı.
   */
  const trimmed = locale?.trim();
  return trimmed ? trimmed : "en-US";
}
