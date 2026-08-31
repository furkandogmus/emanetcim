import type { Metadata } from "next";

/**
 * Paylaşım kartı meta etiketleri — tek kaynak.
 *
 * NEDEN GEREKLİ: Next'te bir sayfa kendi `openGraph` nesnesini verdiğinde, kök
 * yerleşimdeki `openGraph` alan alan birleşmez, BÜTÜNÜYLE yerini alır. Kök
 * yerleşim `og:image`, `siteName` ve `locale` tanımlıyordu; kendi başlığını veren
 * her sayfa üçünü birden düşürüyordu. Üretimde ölçüldü (2026-08-31): `/tr/demand`,
 * `/tr/how-it-works`, `/tr/become-partner` ve diğerlerinde `og:image` HİÇ YOKTU,
 * yani WhatsApp/Facebook/LinkedIn'de paylaşılan her bağlantı görselsiz çıkıyordu.
 *
 * `twitter` ise ayrı bir alan: sayfa yalnızca `openGraph` verdiğinde kökün
 * `twitter` bloğu olduğu gibi kalıyor ve kart, o sayfanın değil ANA SAYFANIN
 * metnini gösteriyordu ("BagajPark — Türkiye'nin Valiz Saklama Ağı"). 19 sayfa
 * bu durumdaydı. Bu yüzden ikisi birlikte, tek yerden üretiliyor.
 *
 * DOSYA KURALI ÇÖZMÜYOR: `app/[locale]/opengraph-image.png` denendi ve ölçüldü --
 * yalnızca o segmentin kendi sayfasına (`/tr`) uygulanıyor, `openGraph`'ını ezen
 * alt sayfalara geçmiyor. Belgede bu açıkça yazmıyor; deneyerek görüldü.
 */
const DEFAULT_OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "BagajPark",
} as const;

export function socialMetadata(input: {
  /** Sayfanın kanonik mutlak adresi. */
  url: string;
  title: string;
  description: string;
  /** Varsayılan marka görseli yerine sayfaya özel görsel(ler). */
  images?: NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;
  /** Blog yazıları için "article"; diğerleri "website". */
  type?: "website" | "article";
  /** `type: "article"` ile birlikte kullanılan ek alanlar. */
  article?: { publishedTime?: string; authors?: string[] };
}): Pick<Metadata, "openGraph" | "twitter"> {
  const images = input.images ?? [DEFAULT_OG_IMAGE];
  /*
    Twitter kartı `images` olarak düz URL dizisi bekliyor. Nesne biçimini de
    kabul ediyor ama iki uçta iki farklı biçim tutmak, birinin diğerinden
    sessizce ayrışmasının olağan yolu -- burada tek yerden türetiliyor.
  */
  const twitterImages = (Array.isArray(images) ? images : [images]).map((i) =>
    typeof i === "string" ? i : i instanceof URL ? i.toString() : i.url.toString(),
  );

  return {
    openGraph: {
      type: input.type ?? "website",
      siteName: "BagajPark",
      url: input.url,
      title: input.title,
      description: input.description,
      images,
      ...(input.article ?? {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: twitterImages,
    },
  };
}
