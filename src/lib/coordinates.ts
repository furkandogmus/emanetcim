/**
 * Admin'in yapıştırdığı konum metnini enlem/boylama çevirir.
 *
 * NEDEN VAR (2026-09-30): esnaf ekleme akışında konum "konumumu bul" ile
 * alınmıyor — admin dükkanda değil, konum onun cihazının konumu olurdu.
 * Kaynak ya esnafın WhatsApp'tan attığı Google Maps linki ya da lead
 * listesindeki `?q=lat,lng` linki. Adresten türetilen konum yetmiyor:
 * Kitaphane (Fethiye) dükkanı gerçek yerinden ~800 m uzakta canlıdaydı ve
 * 2026-09-29'da elle SQL ile düzeltildi. Esnafın kendi pini tek doğru kaynak.
 *
 * Kabul edilen biçimler:
 *   - `36.622931, 29.108484` / `36.622931 29.108484`
 *   - `https://www.google.com/maps?q=36.622931,29.108484`
 *   - `https://www.google.com/maps/place/.../@36.62,29.10,17z/...`
 *   - `...!3d36.62!4d29.10...` (paylaşılan yer linki; `@` harita merkezidir,
 *     `!3d/!4d` işaretçinin kendisi — ikisi birlikte varsa `!3d/!4d` kazanır)
 *
 * Kısaltılmış `maps.app.goo.gl` linkleri çözülmez: yönlendirmeyi takip etmek
 * dış HTTP ister. Böyle bir linkte `null` döner, admin tarayıcıda açıp uzun
 * linki yapıştırır.
 */

export type LatLng = { latitude: number; longitude: number };

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

const PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=${NUM}\s*(?:,|%2C)\s*${NUM}`, "i"),
  new RegExp(String.raw`@${NUM},${NUM}`),
  new RegExp(String.raw`^\s*${NUM}\s*[,\s]\s*${NUM}\s*$`),
];

export function parseCoordinates(raw: string | null | undefined): LatLng | null {
  const input = raw?.trim();
  if (!input) return null;

  for (const re of PATTERNS) {
    const m = input.match(re);
    if (!m) continue;
    const latitude = Number(m[1]);
    const longitude = Number(m[2]);
    if (!isValidLatLng(latitude, longitude)) return null;
    return { latitude, longitude };
  }
  return null;
}

function isValidLatLng(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    // (0,0) Gine Körfezi: bir dükkan değil, boş alanın sayıya dönmüş hali.
    !(latitude === 0 && longitude === 0)
  );
}
