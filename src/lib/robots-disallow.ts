/**
 * `Disallow: /tr/partner` bir ÖNEK eşleşmesidir; "/tr/partners" (herkese
 * açık tanıtım sayfası, bkz. `route-protection.ts`'teki aynı sınıf hata) da
 * bu önekle eşleşir ve arama motorlarının Header/Footer/FAQ'dan bağlanan o
 * sayfayı hiç dizinlememesine yol açar. `$` (tam eşleşme) ve `/` (alt yol)
 * ile ayrıştırılır — diğer önekler (`admin`, `bookings`, `checkout`,
 * `account`, `auth`) için böyle bir kardeş genel sayfa yok.
 */
export function buildDisallowList(locales: readonly string[]): string[] {
  return [
    "/api/",
    ...locales.flatMap((locale) => [
      `/${locale}/admin`,
      `/${locale}/partner$`,
      `/${locale}/partner/`,
      `/${locale}/bookings`,
      `/${locale}/checkout`,
      `/${locale}/account`,
      `/${locale}/auth`,
    ]),
  ];
}
