import { APP_LOCALES, DEFAULT_APP_LOCALE } from "@/i18n/locales";

/**
 * Dili bilinmeyen bir alicida kullanilacak dil.
 *
 * `Booking.locale` bu alandan ONCEKI rezervasyonlarda `null`; okuyan taraf
 * buraya duser, yani eski davranis (Turkce) aynen korunur.
 */
export const DEFAULT_NOTIFICATION_LOCALE: string = DEFAULT_APP_LOCALE;

/**
 * `Accept-Language` basligindan desteklenen bir dil secer.
 *
 * NEDEN VAR (2026-09-02): mobil istemci dilini hicbir yerde bildirmiyordu, o
 * yuzden mobilden yapilan rezervasyonlarda misafirin dili bilinmiyordu ve
 * bildirimler Turkce gidiyordu. Web tarafinda karsiligi `getLocale()` --
 * rota zaten `[locale]` tasiyor.
 *
 * Q-DEGERI SIRALANIR. `Accept-Language: de;q=0.7, en;q=0.9` basliginda dogru
 * cevap `en`dir; basligi soldan okuyup ilk eslesmeyi almak `de` verirdi.
 * Tarayicilar ve mobil isletim sistemleri bu basligi siralanmamis olarak
 * gonderebiliyor.
 *
 * Bolge etiketi DUSURULUR: `en-GB` -> `en`. Desteklenen liste dil kodlarindan
 * ibaret; `en-GB` gonderen bir istemciye Turkce gondermek olurdu.
 */
export function resolveRequestLocale(acceptLanguage: string | null | undefined): string {
  if (!acceptLanguage) return DEFAULT_NOTIFICATION_LOCALE;

  const desteklenen = APP_LOCALES as readonly string[];
  const adaylar = acceptLanguage
    .split(",")
    .map((parca) => {
      const [etiketHam, ...parametreler] = parca.trim().split(";");
      const etiket = etiketHam.trim().toLowerCase();
      const q = parametreler
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const agirlik = q ? Number(q.slice(2)) : 1;
      return {
        dil: etiket.split("-")[0],
        agirlik: Number.isFinite(agirlik) ? agirlik : 0,
      };
    })
    .filter((a) => a.dil.length > 0 && a.agirlik > 0)
    .sort((a, b) => b.agirlik - a.agirlik);

  for (const aday of adaylar) {
    if (desteklenen.includes(aday.dil)) return aday.dil;
  }
  return DEFAULT_NOTIFICATION_LOCALE;
}
