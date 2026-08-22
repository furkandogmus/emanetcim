import type { Prisma } from "@prisma/client";

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
