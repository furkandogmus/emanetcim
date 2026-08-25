/**
 * Sitenin GÖRSEL KİMLİĞİ — tek bir anahtar.
 *
 * NEDEN VAR (2026-08-24'te ölçüldü): görsel dil ~1.900 yerde elle yazılmıştı
 * (`orange-*` 687, `font-black` 615, `tracking-widest` 284, büyük `rounded-*`
 * 155). Sonucu şuydu: görünüm DEĞİŞTİRİLEMİYORDU — "tasarımı elden geçirelim"
 * demek 90+ dosyayı elle düzenlemek demekti, o yüzden hiç yapılmadı.
 *
 * VARSAYILAN = SİTENİN KENDİ GÖRÜNÜMÜ (turuncu · font-black · yuvarlak köşe).
 * 24 Ağustos 2026'da varsayılan kısa süreliğine "fiş" diline çevrilmişti;
 * beğenilmediği için 25 Ağustos'ta geri alındı. Fiş dili SİLİNMEDİ, `ticket`
 * yönü olarak duruyor — kimlik katmanının bütün amacı bunu tek değişkenle
 * denenebilir kılmak.
 *
 * Değerleri `globals.css` içindeki KİMLİK KATMANI bloklarında; buradaki tek iş,
 * varsayılandan farklı bir blok seçilecekse hangisi olduğunu söylemek.
 */

export const SITE_IDENTITIES = ["default", "ticket", "seal", "shop"] as const;
export type SiteIdentity = (typeof SITE_IDENTITIES)[number];

/**
 * `NEXT_PUBLIC_SITE_IDENTITY` ile seçilir; tanımsızsa sitenin kendi görünümü.
 *
 * Ortam değişkeni olmasının nedeni: bir yönü PROD'A DOKUNMADAN önizleme
 * dağıtımında denemek — ve bir aksilik çıkarsa değişkeni kaldırıp varsayılana
 * dönebilmek.
 */
export function resolveSiteIdentity(
  raw: string | undefined = process.env.NEXT_PUBLIC_SITE_IDENTITY,
): SiteIdentity {
  const value = raw?.trim().toLowerCase();
  return (SITE_IDENTITIES as readonly string[]).includes(value ?? "")
    ? (value as SiteIdentity)
    : "default";
}

/**
 * `<html>` özniteliği. "default" için öznitelik HİÇ basılmaz: değerler zaten
 * `:root`'ta, fazladan bir seçicinin eşleşmesine gerek yok.
 */
export function siteIdentityAttribute(
  identity: SiteIdentity = resolveSiteIdentity(),
): { "data-identity"?: SiteIdentity } {
  return identity === "default" ? {} : { "data-identity": identity };
}
