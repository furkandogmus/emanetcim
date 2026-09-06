import sanitizeHtml from "sanitize-html";

/**
 * YONETICI YAZDIGI ZENGIN METNIN TEMIZLENMESI.
 *
 * NEDEN VAR (2026-08-31): `blog/[slug]` sayfasi `post.content`i
 * `dangerouslySetInnerHTML` ile ham basiyordu. Icerigi YONETICI yaziyor
 * (`/admin/blog`), yani bu bilincli bir zengin metin ozelligi -- ama tek
 * savunma "yoneticiye guveniyoruz" olamaz:
 *
 *   - Yonetici hesabi ele gecirilirse depolanmis XSS olur ve SITEYI ZIYARET
 *     EDEN HERKESI vurur. CSP'de `'unsafe-inline'` var (Next'in acilis
 *     script'leri icin, nonce'a gecilene kadar bilincli taviz), yani enjekte
 *     edilen script CALISIR.
 *   - Bu oturumda ayni sinifin iki ornegi zaten bulundu: JSON-LD'ye giren
 *     dukkan adi ve e-posta govdesine giren dukkan adi. Ikisi de "guvenilir"
 *     sanilan kaynaklardi.
 *
 * ALLOWLIST YAKLASIMI: neyin YASAK oldugunu saymak yerine neyin SERBEST
 * oldugunu sayiyoruz. Yasak listesi her zaman eksiktir -- yeni bir etiket ya da
 * oznitelik cikinca sessizce acik kalir.
 *
 * KENDI TEMIZLEYICIMIZI YAZMIYORUZ. HTML ayristirma tuzaklarla dolu
 * (`<img src=x onerror=...>`, `<svg><script>`, `javascript:` URL'leri, mutasyon
 * XSS). `sanitize-html` bu isi yapan, bakimi surdurulen ve sunucu tarafinda
 * calisan yerlesik cozum.
 */

/**
 * Blog govdesinde SERBEST etiketler.
 *
 * Mevcut yazilarin kullandiklari korunuyor: basliklar, paragraf, liste, kalin/
 * italik, baglanti, gorsel, alinti, kod, tablo. `prose-*` siniflari zaten bu
 * kumeyi bicimlendiriyor.
 *
 * BILEREK DISARIDA: `script`, `style`, `iframe`, `object`, `embed`, `form`,
 * `input`, `svg`. Bunlarin hicbiri bir blog yazisinda gerekli degil ve her biri
 * ayri bir kod calistirma yuzeyi.
 */
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "s",
  "a", "img", "figure", "figcaption",
  "blockquote", "code", "pre",
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div",
];

/**
 * `class` SERBEST cunku yazilar `prose` siniflarina dayaniyor. `style` DEGIL:
 * `style` icinden `expression()` / `url(javascript:)` gibi eski saldirilar ve
 * kullaniciyi kandiran tam ekran katmanlar kurulabiliyor.
 */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  "*": ["class", "id"],
};

/**
 * Yalnizca bu semalar. `javascript:` ve `data:` YOK -- ikisi de baglanti ya da
 * gorsel kiliginda kod calistirmanin klasik yolu.
 */
const ALLOWED_SCHEMES = ["http", "https", "mailto"];

/**
 * Zengin metni DUZ METNE indirger (ozet/meta description icin).
 *
 * `content.replace(/<[^>]*>/g, "")` KULLANMAYIN: iç içe/bozuk etiketlerde
 * (`<<script>script>`) regex etiketi tam temizleyemeyebilir. `sanitize-html`
 * gercek bir HTML ayrıştırıcı kullanıyor — `allowedTags: []` her etiketi
 * güvenli şekilde çıkarır, regex'in düşebileceği tuzaklara düşmez.
 */
export function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesAppliedToAttributes: ["href", "src"],
    /*
      Disari acilan her baglanti `rel="noopener noreferrer"` alir: `target`
      belirtilmis bir baglanti aksi halde acilan sayfaya `window.opener`
      uzerinden erisim verir (tabnabbing).
    */
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
      }),
    },
    // Kapatilmamis etiketler duzeltilir; yarim HTML sayfa duzenini bozmasin.
    disallowedTagsMode: "discard",
  });
}
