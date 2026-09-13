/**
 * 2026-08-22'de kaldırılan diller (bkz. `src/i18n/routing.ts`).
 *
 * NEDEN YÖNLENDİRME (2026-09-13): Google bu dillerin URL'lerini hâlâ
 * gösteriyordu — 6 Haz–10 Eyl arasında bu sekiz dilin sayfaları 4.385
 * gösterim ve 13 tıklama aldı (en çok `/ru/luggage-storage/antalya`).
 * Bu URL'ler şimdi next-intl'in önekine düşüyor: `/ko/luggage-storage/berlin`
 * → 307 → `/tr/ko/luggage-storage/berlin` → catch-all → HTTP 200 + noindex,
 * yani yumuşak 404. Sayfanın bağlantı değeri hiçbir yere aktarılmıyor ve
 * Google geçici (307) yönlendirmeyi aylarca yeniden deniyor.
 *
 * Kalıcı (308) yönlendirme İngilizce karşılığa: kaldırma gerekçesi zaten
 * "bu ziyaretçiler İngilizce okur"du ve her rotanın `/en` sürümü var.
 */
export const RETIRED_LOCALES = ["es", "it", "zh", "ar", "ko", "ru", "bg", "pl"] as const;

const RETIRED_PREFIX = new RegExp(`^/(?:${RETIRED_LOCALES.join("|")})(/.*)?$`);

/** Kaldırılmış dil önekli yolsa `/en` karşılığını, değilse `null` döner. */
export function retiredLocaleRedirectPath(pathname: string): string | null {
  const match = RETIRED_PREFIX.exec(pathname);
  if (!match) return null;
  return `/en${match[1] ?? ""}`;
}
