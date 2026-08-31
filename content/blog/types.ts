/**
 * ŞEHİR BLOG YAZILARININ VERİ TİPLERİ.
 *
 * NEDEN AYRI BİR KLASÖR: `src/lib/blog-initializer.ts` içindeki `DEFAULT_POSTS`
 * dizisi ilk altı yazı için yeterliydi; talep testi noktalarının sayısı 265
 * şehre çıkınca aynı dosyada büyütmek iki şeyi birden bozuyordu — dosya Next
 * paketine giriyor (her yazı istemci tarafına taşınacak ağırlık) ve tek dosyada
 * yüzlerce yazıyı yan yana düzenlemek çakışma üretiyor. İçerik burada durur,
 * `scripts/blog-city-posts.ts` onu veritabanına yazar; uygulama kodu içeriği
 * hiç import etmez.
 *
 * GÖRSEL YERLEŞTİRME `{{img:anahtar}}` İLE YAPILIR, ham `<img>` ile DEĞİL.
 * Sebep tek cümle: ham `<img>` yazıldığında `alt` metni ve fotoğrafın telif
 * künyesi yazarın hatırlamasına kalıyor ve ikisi de sessizce unutuluyor.
 * Yer tutucu genişletildiğinde ikisi de manifestten GELİR — unutulamaz.
 */

/** Sitenin blog yazısı taşıdığı diller. Yeni dil eklerken `--verify` uyarır. */
export type BlogLocale = "tr" | "en";

export type CityBlogPost = {
  locale: BlogLocale;
  /** Global tekil (`BlogPost.slug` @unique). Şehir adıyla başlar. */
  slug: string;
  title: string;
  excerpt: string;
  /** `content/blog/images.json` içindeki anahtar — kapak görseli. */
  cover: string;
  authorName?: string;
  /**
   * Yazı gövdesi. İzin verilen etiketler `src/lib/rich-text.ts` allowlist'i ile
   * SINIRLI — oradan geçmeyen etiket yayında sessizce düşer.
   * Görsel için `{{img:anahtar}}` satırı kullanılır.
   */
  body: string;
};

export type CityBlogEntry = {
  /** `scripts/prelaunch-points.ts` içindeki `key` ile AYNI olmak zorunda. */
  cityKey: string;
  posts: CityBlogPost[];
};

/**
 * Bir fotoğrafın künyesi. `license`/`author`/`source` ZORUNLU: Wikimedia
 * Commons görsellerinin çoğu CC BY-SA, yani atıfsız kullanım lisans ihlali.
 * Künye yazının sonunda otomatik basılır.
 */
export type BlogImage = {
  /** `public/` altındaki yol — `/images/blog/....webp` */
  file: string;
  alt: { tr: string; en: string };
  /** Görselin gerçekte NEYİ gösterdiği; künye satırında geçer. */
  caption: { tr: string; en: string };
  /** Commons dosya sayfası ya da özgün kaynak URL'i. */
  source: string;
  author: string;
  license: string;
  /** Hangi şehrin görseli — `--verify` alakasız eşleşmeyi burada yakalar. */
  cityKey: string;
};

export type BlogImageManifest = Record<string, BlogImage>;
