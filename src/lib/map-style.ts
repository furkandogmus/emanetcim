/**
 * Harita altlığı — TEK KAYNAK.
 *
 * NEDEN BURADA: altlık iki bileşende AYRI AYRI ve FARKLI sağlayıcılarla
 * yazılmıştı — `SearchMap` CARTO raster, `LocationPicker` doğrudan
 * `tile.openstreetmap.org`. İkisi de bozuktu, ama farklı şekilde bozuk
 * oldukları için biri düzeltilirken diğeri geride kalırdı.
 *
 * 1. CARTO artık API anahtarı ZORUNLU tutuyor. Anahtarsız çekilen her karo
 *    üzerine "API KEY REQUIRED / carto.com/basemaps/apikey" filigranı basılıyor
 *    ve misafirin gördüğü arama haritası bu hâldeydi. Anahtar almak yerine
 *    sağlayıcıyı tamamen bıraktık: kimseden bir şey beklemeyen bir altlık,
 *    bir dakikada alınan ama bir gün süresi dolan anahtardan iyidir.
 *
 * 2. `tile.openstreetmap.org` bir CDN değil, bağışla dönen topluluk
 *    altyapısıdır ve kullanım politikası ticari servisleri açıkça uyarıyor:
 *    *"Commercial services... should be especially aware that access may be
 *    withdrawn at any point: you may no longer be able to serve your paying
 *    customers if access is withdrawn."* Ayrıca uygulamanın kendine özgü bir
 *    `User-Agent` göndermesini şart koşuyor — tarayıcıdaki bir harita bunu
 *    YAPAMAZ, yani o kullanım baştan politikaya uygun değildi.
 *    Kaynak: https://operations.osmfoundation.org/policies/tiles/
 *
 * ALTLIK: OpenFreeMap — veri yine OpenStreetMap, ama karoları ticari kullanıma
 * açık bir sunucudan geliyor. Anahtar istemiyor, istek limiti yok (kaynak:
 * https://openfreemap.org — *"no registration, no user database, no API keys"*,
 * *"no limits on the number of map views or requests"*, ticari kullanım
 * sorusuna cevabı: *"Yes"*). Yani yapılandırma olmadan bugün çalışır.
 */

/**
 * OpenFreeMap stilleri arasından `bright`. `positron` denendi ve bırakıldı:
 * her şeyi gri tonlarına indiriyor, harita ölü görünüyordu. `bright` yeşil
 * alanları, suyu ve yol hiyerarşisini renkle ayırıyor.
 */
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

/**
 * MapLibre'ye verilecek `style` değeri: vektör stilinin URL'i.
 * Atıf (OpenStreetMap katkıcıları) stilin kendi içinde geliyor.
 */
export function getMapStyle(): string {
  return OPENFREEMAP_STYLE;
}

/** Testlerin ve gözden geçirmenin okuyabilmesi için dışa açık. */
export const MAP_STYLE_URL = OPENFREEMAP_STYLE;

/**
 * Harita atfı — HER haritada gösterilmesi ZORUNLU.
 *
 * NEDEN SABİT, sağlayıcıdan gelen değil: OpenStreetMap verisi ODbL altında ve
 * atıf bir tercih değil, lisans şartı. Bugün OpenFreeMap bu metni TileJSON'ın
 * içinde gönderiyor ve MapLibre onu otomatik gösteriyor — ama o zincirin
 * sessizce kopabildiği ÖLÇÜLDÜ: 2026-08-31'de canlıda atıf kutusunda yalnızca
 * "MapLibre" yazıyordu, tek satır OSM kredisi yoktu (vektör kaynağı o tarayıcıda
 * yüklenememişti; atıf da onunla birlikte kaybolmuştu). Üçüncü tarafın bir JSON
 * alanına bağlı bir lisans yükümlülüğü, yükümlülüğü karşılamıyor.
 *
 * `LocationPicker` daha da ileri gidiyordu: `attributionControl: false` ile atıf
 * kutusunu TAMAMEN kapatmıştı.
 */
export const MAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';
