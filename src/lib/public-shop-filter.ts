import type { Prisma } from "@prisma/client";
import { distanceKm } from "@/lib/geo";

/**
 * Bir dükkanın MİSAFİRE görünmesi için sağlaması gereken koşullar — tek kaynak.
 *
 * NEDEN TEK YERDE: bu filtre üç ayrı yerde ayrı ayrı yazılmıştı
 * (`shop-distance-postgis.ts` içinde iki kez, `guest-landing-stats.ts` içinde bir
 * kez) ve hepsi yalnızca `isActive`'e bakıyordu. Bir test dükkanı bu yüzden canlı
 * aramada gerçek partnerlerin yanında görünüyordu (P1-4). Yeni bir dışlama ölçütü
 * eklemek üç dosyayı birden hatırlamayı gerektiriyordu — dördüncüsü eklendiğinde
 * biri kesin unutulurdu.
 *
 * Yeni bir ölçüt eklerken BURAYI ve `PUBLIC_SHOP_SQL_CONDITION`'ı birlikte
 * güncelleyin; `public-shop-filter.test.ts` ikisinin ayrışmasını yakalar.
 */
export const PUBLIC_SHOP_FILTER = {
  isActive: true,
  isTest: false,
} as const satisfies Prisma.ShopWhereInput;

/**
 * Aynı koşulun ham SQL karşılığı.
 *
 * PostGIS mesafe sorgusu Prisma'nın `where` nesnesini kullanamıyor (ham SQL);
 * bu yüzden koşul burada bir kez daha yazılıyor. İki tanımın ayrışması
 * `public-shop-filter.test.ts` tarafından yakalanır.
 *
 * Tablo takma adı `s` varsayılır.
 */
export const PUBLIC_SHOP_SQL_CONDITION = `s."isActive" = true AND s."isTest" = false`;

/**
 * Bir dükkanın GERÇEKTEN İŞLETİLİYOR olması için gereken koşullar.
 *
 * `PUBLIC_SHOP_FILTER`'dan FARKI tek kelime: talep testi noktaları misafire
 * GÖRÜNÜR (aramada, haritada, detayda) ama işletilmiyorlar — slot üretilmez,
 * rezervasyon alınmaz, mühür beklenmez, sağlık kontrolleri onlardan slot
 * beklemez. İki soruyu ayırmak zorundayız çünkü cevapları farklı:
 *
 *   "misafire gösterilsin mi?"  -> PUBLIC_SHOP_FILTER   (prelaunch DAHIL)
 *   "burada iş yapılıyor mu?"   -> OPERATING_SHOP_FILTER (prelaunch HARIÇ)
 *
 * Bir prelaunch noktası bu filtreden geçseydi slot üreteci ona 30 günlük slot
 * yazar, `/api/health/jobs` ondan slot bekler ve mühür/gecikme kontrolleri onu
 * gerçek bir işletme sanardı — yani talep testi, kurduğumuz sağlık sinyalini
 * kirletirdi.
 */
export const OPERATING_SHOP_FILTER = {
  isActive: true,
  isTest: false,
  isPrelaunch: false,
} as const satisfies Prisma.ShopWhereInput;

/** `OPERATING_SHOP_FILTER`'ın ham SQL karşılığı. Tablo takma adı `s` varsayılır. */
export const OPERATING_SHOP_SQL_CONDITION =
  `s."isActive" = true AND s."isTest" = false AND s."isPrelaunch" = false`;

/**
 * İNCELEME KUM HAVUZU (2026-11-23): dükkan listesine BAKAN kişi.
 *
 * NEDEN VAR: Apple App Review demo hesapla rezervasyon akışını baştan sona
 * deniyor. Test dükkanları (`isTest`) herkesten gizli olduğu için inceleyici
 * GERÇEK bir esnafa rezervasyon açıyor ve gerçek esnafa bildirim gidiyordu.
 * Kural: `User.reviewSandbox` olan kullanıcı test dükkanlarını EK OLARAK görür ve
 * onlara rezervasyon yapabilir. Anonim istek ve gerçek kullanıcı için
 * davranış birebir eskisi: aşağıdaki yardımcılar onlara sabitlerin KENDİSİNİ
 * döndürür.
 *
 * Tek kural, tek yer: mobil arama, detay, yorumlar, quote ve intent bu
 * yardımcılardan geçer. Toplu sayımlar (şehir/ilçe kapsamı, site haritası,
 * ana sayfa istatistiği) BİLEREK izleyiciye duyarsız kalır; paylaşılan
 * önbelleğe test dükkanı karışmasın.
 */
export type ShopViewer = { reviewSandbox?: boolean | null } | null | undefined;

/**
 * Yalnızca açıkça `reviewSandbox: true` olan izleyici kum havuzunu görür; eksik alan = gerçek
 * kullanıcı. `User.isTest` BİLEREK kullanılmaz: o elle verilen bir etiket, davranışı değiştirmez.
 */
export function isSandboxViewer(viewer: ShopViewer): boolean {
  return viewer?.reviewSandbox === true;
}

/** Kum havuzu dükkanı: test kaydı ama pasif değil (pasif test dükkanı test kullanıcısından da gizli). */
const SANDBOX_SHOP_FILTER = { isActive: true, isTest: true } as const satisfies Prisma.ShopWhereInput;

/** `PUBLIC_SHOP_FILTER`ın izleyiciye göre hali: "bu kişiye gösterilsin mi?" */
export function shopVisibilityFilter(viewer: ShopViewer): Prisma.ShopWhereInput {
  return isSandboxViewer(viewer) ? { OR: [PUBLIC_SHOP_FILTER, SANDBOX_SHOP_FILTER] } : PUBLIC_SHOP_FILTER;
}

/** `PUBLIC_SHOP_SQL_CONDITION`ın izleyiciye göre hali. Tablo takma adı `s`; parantezli döner. */
export function shopVisibilitySqlCondition(viewer: ShopViewer): string {
  return isSandboxViewer(viewer)
    ? `((${PUBLIC_SHOP_SQL_CONDITION}) OR (s."isActive" = true AND s."isTest" = true))`
    : PUBLIC_SHOP_SQL_CONDITION;
}

/**
 * "Bu kişi bu dükkana rezervasyon açabilir mi?" — `OPERATING_SHOP_FILTER`ın
 * satır üstündeki karşılığı. Prelaunch noktası test kullanıcısına da kapalı:
 * slot üretilmiyor, işletilmiyor.
 */
export function isShopBookableBy(
  shop: { isActive: boolean; isTest: boolean; isPrelaunch: boolean },
  viewer: ShopViewer,
): boolean {
  if (!shop.isActive || shop.isPrelaunch) return false;
  return !shop.isTest || isSandboxViewer(viewer);
}

/**
 * Talep testi noktası, yakınında GERÇEK bir dükkan açılınca misafirden gizlenir.
 *
 * NEDEN VAR (2026-09-30): prelaunch noktası "bu semtte talep var mı" sorusunu
 * ölçmek için semt merkezine konmuş, rezervasyon ALMAYAN bir işaret. Aynı semtte
 * rezervasyon alan bir esnaf açıldığında misafir haritada ikisini yan yana
 * görüyor ve "yakında açılıyor" diyeni seçip boşa düşebiliyordu — oysa soru
 * cevaplanmış: orada artık gerçek bir nokta var. İlk örnek Alanya: Merlin Home
 * Tekstil ile "Alanya Kalesi Emanet Noktası" arası ~1,8 km.
 *
 * 2 km: prelaunch noktaları semt merkezinde durduğu için semt ölçeği. Nokta
 * SİLİNMEZ ve kapatılmaz: esnaf pasife alınırsa kendiliğinden geri gelir,
 * `PrelaunchInterest` kayıtları ve admin'in prelaunch ekranı etkilenmez.
 * Yalnızca misafirin gördüğü listeden (arama, harita, şehir sayfası) düşer.
 */
export const PRELAUNCH_SUPERSEDED_RADIUS_KM = 2;

/**
 * `hideSupersededPrelaunch`in ham SQL karşılığı. Tablo takma adı `s` varsayılır;
 * iç sorgu `o` kullanır. Mesafe ifadesi `Shop_geog_gist_idx` ile aynı biçimde
 * yazıldı ki `ST_DWithin` indeksi kullanabilsin.
 */
export const PRELAUNCH_NOT_SUPERSEDED_SQL_CONDITION = `NOT (
  s."isPrelaunch" = true
  AND s."latitude" IS NOT NULL AND s."longitude" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Shop" o
    WHERE ${OPERATING_SHOP_SQL_CONDITION.replace(/\bs\./g, "o.")}
      AND o."latitude" IS NOT NULL AND o."longitude" IS NOT NULL
      AND ST_DWithin(
        geography(ST_SetSRID(ST_MakePoint(o."longitude", o."latitude"), 4326)),
        geography(ST_SetSRID(ST_MakePoint(s."longitude", s."latitude"), 4326)),
        ${PRELAUNCH_SUPERSEDED_RADIUS_KM * 1000}
      )
  )
)`;

type ShopLike = {
  isActive: boolean;
  isTest: boolean;
  isPrelaunch: boolean;
  latitude: number | null;
  longitude: number | null;
};

/**
 * PostGIS olmayan yol için aynı kural. `shops` MİSAFİRE görünen dükkanların
 * TAMAMI olmalı, yarıçapla daraltılmış bir alt küme değil: arama yarıçapının
 * hemen dışındaki bir esnaf da içerideki prelaunch noktasını gizler.
 */
export function hideSupersededPrelaunch<T extends ShopLike>(shops: T[]): T[] {
  const operating = shops.filter(
    (s) =>
      s.isActive && !s.isTest && !s.isPrelaunch && s.latitude != null && s.longitude != null,
  );
  if (operating.length === 0) return shops;
  return shops.filter(
    (s) =>
      !s.isPrelaunch ||
      s.latitude == null ||
      s.longitude == null ||
      !operating.some(
        (o) =>
          distanceKm(s.latitude!, s.longitude!, o.latitude!, o.longitude!) <=
          PRELAUNCH_SUPERSEDED_RADIUS_KM,
      ),
  );
}
