import { cache } from "react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { shopService } from "@/services/ShopService";
import ShopDetailClient from "@/components/guest/ShopDetailClient";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { buildShopLocalBusinessJsonLd } from "@/lib/shop-json-ld";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-json-ld";
import { routing } from "@/i18n/routing";
import { auth } from "@/auth";
import { analyticsService } from "@/services/AnalyticsService";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import { socialMetadata } from "@/lib/social-metadata";
import { serializeJsonLd } from "@/lib/json-ld-script";

/**
 * Ayni istek icinde TEK sorgu.
 *
 * Next `generateMetadata` ile sayfa govdesini ayri calistiriyor ve ikisi de bu
 * dukkani okuyor -- yani her sayfa gorunumu ayni satiri IKI KEZ sorguluyordu.
 * React `cache` istek basina bellekliyor; ikinci cagri veritabanina hic gitmez.
 */
const shopPublicDetail = cache((shopId: string) =>
  shopService.getShopPublicDetail(shopId),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}): Promise<Metadata> {
  const { locale, shopId } = await params;
  /*
    METADATA DA GOVDEYLE AYNI FILTREYI KULLANIR (2026-08-31'de bulundu).

    Burasi `getShopDetails` cagiriyordu: filtresiz bir `findUnique`. Sonra elle
    `!shop.isActive` kontrol ediyordu -- ama `PUBLIC_SHOP_FILTER` IKI kosul
    tasiyor: `isActive: true` VE `isTest: false`. Yani bir TEST dukkani icin
    metadata basariyla uretiliyor, sayfa govdesi ise `notFound()` cagiriyordu.

    Sonucu: URL'i bilen biri, 404 donen bir sayfanin `<title>`, `<meta
    description>` ve Open Graph alanlarinda test dukkaninin ADINI ve ADRESINI
    goruyordu. Arama motorlari da o basligi gorebiliyordu.

    `public-shop-filter.ts` bunu kelimesi kelimesine ongormustu: "yeni bir cagri
    yeri eklendiginde biri unutulurdu". Unutulan cagri yeri, filtreyi dogru
    kullanan govdenin HEMEN USTUNDEYDI.

    `getShopPublicDetail` ayrica govdedeki cagriyla tekillestiriliyor
    (`shopPublicDetail`, React `cache`): Next `generateMetadata` ile sayfayi
    ayri calistiriyor, yani ayni dukkan istek basina IKI KEZ sorgulaniyordu.
  */
  const shop = await shopPublicDetail(shopId);
  const t = await getTranslations({ locale, namespace: "Guest" });
  if (!shop) {
    return { title: t("shopDetailNotFoundTitle") };
  }
  const base = getSiteBaseUrl();
  const title = `${shop.name} — ${t("shopDetailTitleSuffix")}`;
  const description = shop.address ?? t("shopDetailMetaFallback");
  const canonical = `${base}/${locale}/shop/${shopId}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = `${base}/${loc}/shop/${shopId}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}/shop/${shopId}`;
  return {
    title,
    description,
    /*
      Talep testi noktasi DIZINE GIRMEZ, ama baglantilari izlenir.

      Bu sayfa rezervasyon almiyor ve 482 tanesi neredeyse ayni. Aramadan gelen
      bir ziyaretci burada aradigini bulamaz -- yani hem kotu bir kullanici
      deneyimi hem de arama motoruna kotu bir kalite sinyali. `follow` kaliyor
      ki sayfadaki gercek baglantilar (talep haritasi, esnaf basvurusu)
      taranabilsin.

      Nokta hizmete acildiginda `isPrelaunch` false olur ve sayfa kendiliginden
      dizine acilir; ayrica bir sey yapmak gerekmiyor.
    */
    ...(shop.isPrelaunch ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, languages },
    ...socialMetadata({
      url: canonical,
      title,
      description,
    }),
  };
}

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}) {
  const { locale, shopId } = await params;
  setRequestLocale(locale);

  /*
    BAGIMSIZ OKUMALAR PARALEL (2026-08-31'de olculdu).

    Bu sayfa isteklerin buyuk cogunlugunu alan iki sayfadan biri ve okumalari
    SIRAYLA yapiyordu: dukkan -> oturum -> analitik oturum kimligi -> gorseller
    -> fiyat kurallari. Bes ayri gidis-donus, hicbiri digerinin sonucuna
    ihtiyac duymadigi halde arka arkaya. Toplam gecikme, en yavas sorgunun
    degil, HEPSININ TOPLAMIYDI.

    Dordu gercekten bagimsiz ve birlikte bekleniyor. `wantCount` disarida
    kaliyor cunku SARTI dukkandan geliyor (`shop.isPrelaunch`) -- isletilen
    dukkanlarda o sorgu hic calismamali.

    `Promise.all` yerine `allSettled` DEGIL: `getShopPublicDetail` bulunamazsa
    `notFound()` gerekiyor ve digerlerinin hatasi zaten `.catch` ile
    yutuluyor. Yani burada bastirilacak bir hata yok.
  */
  const [shop, session, shopImages, pricingRules] = await Promise.all([
    shopPublicDetail(shopId),
    auth(),
    shopService.getShopImages(shopId).catch(() => []),
    getPricingRules(),
  ]);

  if (!shop) {
    notFound();
  }

  analyticsService.track({
    name: "shop_view",
    sessionId: await resolveServerSessionId(session?.user?.id),
    userId: session?.user?.id ?? null,
    locale,
    metadata: { shopId: shop.id },
  });

  /*
    Talep testi noktasinda "kac kisi burayi istiyor" sayisi SUNUCUDA okunur:
    misafir sayfayi actigi anda gormeli, tiklamayi beklememeli -- gorunen sayi
    tiklamanin kendisini tesvik eden seyin ta kendisi. Isletilen dukkanlarda
    sorgu hic calismaz -- bu yuzden yukaridaki paralel bloga GIRMIYOR.
  */
  const prelaunchWantCount = shop.isPrelaunch
    ? await prelaunchInterestService.wantCount(shopId).catch(() => 0)
    : 0;

  const jsonLd = buildShopLocalBusinessJsonLd(shop, locale);
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: tCommon("mobileNavHome"), path: `/${locale}` },
    { name: tCommon("mobileNavSearch"), path: `/${locale}/search` },
    { name: shop.name, path: `/${locale}/shop/${shop.id}` },
  ]);

  const clientShop = {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    image: shop.image,
    description: shop.description,
    latitude: shop.latitude,
    longitude: shop.longitude,
    capacity: shop.capacity,
    rating: shop.rating,
    pricePerDay: moneyToNumber(shop.pricePerDay),
    hasRestroom: shop.hasRestroom,
    hasCctv: shop.hasCctv,
    hasClimateControl: shop.hasClimateControl,
    acceptsLargeItems: shop.acceptsLargeItems,
    open247: shop.open247,
    openingTime: shop.openingTime,
    closingTime: shop.closingTime,
    isVerified: shop.isVerified,
    isPrelaunch: shop.isPrelaunch,
    responseTimeMinutes: shop.responseTimeMinutes,
    reviews: shop.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      authorLabel:
        r.guest?.name?.trim()?.split(/\s+/)[0] ?? "",
    })),
    images: shopImages.map((img) => ({
      id: img.id,
      url: img.url,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />
      <ShopDetailClient
        shop={clientShop}
        pricingRules={JSON.parse(JSON.stringify(pricingRules))}
        prelaunchWantCount={prelaunchWantCount}
      />
    </>
  );
}
