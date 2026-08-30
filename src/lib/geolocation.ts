/**
 * Tarayıcı konum erişimi — TEK YER.
 *
 * NEDEN BURADA: arama sayfası konumu artık İKİ yerden istiyor — açılıştaki
 * otomatik deneme ve "konumumu bul" düğmesi. Aynı çağrıyı iki kez yazmak,
 * iki farklı davranış demekti: biri `enableHighAccuracy` verir diğeri vermez,
 * biri zaman aşımı koyar diğeri sonsuza kadar bekler.
 *
 * `readGeoPermission` ise tek başına burada olmayı hak ediyor: izin durumunu
 * SORMADAN okuyabilmek, reddedilmiş bir izinde boş bir çağrı yapmamayı sağlar.
 *
 * (Esnaf panelindeki `LocationPicker` kendi çağrısını koruyor: orası konumu
 * alıp ters coğrafi kodlamaya sokan daha uzun bir akış ve bu turda ona
 * dokunulmadı.)
 */

export type GeoPoint = { lat: number; lng: number };

/**
 * İzin durumu. `unknown`, Permissions API'nin bu tarayıcıda konum için
 * cevap VERMEDİĞİ hâldir (Safari'nin uzun süre öyleydi) — "izin yok" ile
 * karıştırılmamalı.
 */
export type GeoPermission = "granted" | "denied" | "prompt" | "unknown";

/**
 * İzni SORMADAN mevcut durumu okur.
 *
 * Bunun değeri şu: durum `denied` ise `getCurrentPosition` çağırmak hiçbir şey
 * yapmaz — tarayıcı kullanıcıya ikinci kez sormaz, yalnızca hata döner. Önden
 * bakmak, o boş çağrıyı ve onunla gelen gereksiz bekleyişi tamamen atlatır.
 */
export async function readGeoPermission(): Promise<GeoPermission> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "denied";
  if (!navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    // Bazi tarayicilar "geolocation" adini tanimaz ve firlatir. Tanimamak,
    // iznin olmadigi anlamina gelmez.
    return "unknown";
  }
}

/** `getCurrentPosition`'ın promise hâli. Reddedilirse `GeolocationPositionError` fırlatır. */
export function getCurrentPoint(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10_000 },
): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation_unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      options,
    );
  });
}

/** `navigator.geolocation` bu tarayıcıda var mı. */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}
