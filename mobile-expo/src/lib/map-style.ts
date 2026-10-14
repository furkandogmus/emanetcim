/**
 * Harita altligi -- web'deki `src/lib/map-style.ts` ve Flutter'daki
 * `map_style.dart` ile AYNI kaynak: OpenFreeMap "bright".
 *
 * Neden Google Maps degil: anahtar istemiyor, istek limiti yok, ticari kullanima
 * acik (gerekce web dosyasinda kaynaklariyla yazili). Expo Go'nun gomulu Google
 * anahtari 2026-10-14'te emulatorde "Authorization failure" verdi; uretim icin
 * zaten ayri anahtar ve konsol ayari gerekecekti.
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

/**
 * OSM verisi ODbL altinda; atif lisans SARTI, tercih degil. Stilin kendi
 * atfina guvenilmez (web'de bir kez sessizce kayboldu) -- ekranda sabit yazilir.
 */
export const MAP_ATTRIBUTION = "© OpenStreetMap · OpenFreeMap";
