/** Arama sayfası: varsayılan harita merkezi (İstanbul). */
export const SEARCH_DEFAULT_CENTER = { lat: 41.0256, lng: 28.9741 } as const;

export const SEARCH_NEARBY_RADIUS_KM = 10;

/**
 * "Tum Noktalar" sekmesinin ULASILABILIR CEVRE tavani (km).
 *
 * NEDEN VAR (2026-09-01'de uretimde olculdu): bu liste `radiusKm: null` ile
 * cekiliyordu, yani "mesafeye gore sirali ilk 100 nokta" -- nerede olursa
 * olsun. `/tr/search?q=amsterdam` sekmede "TUM NOKTALAR (100)" yaziyordu ve o
 * yuzun sonuncusu Amsterdam'a 1.128 km uzaktaki Stockholm noktasiydi. Arada
 * Varsova, Anvers, Brugge vardi. Hicbiri valizini birakabilecegin bir yer
 * degil; sayi da bir yerin nokta sayisi degil, `take: 100` tavaniydi.
 *
 * 150 km "ayni gun icinde gidilebilir" demek: Amsterdam aramasi Den Haag (51
 * km) ve Rotterdam'i (58 km) tutar, Anvers'i (133 km) daha tutar, Varsova'yi
 * birakir. Yakindaki sekmesinin 10 km'lik yariyapindan sonra gelen ikinci
 * halka budur -- "yakinda yoksa biraz oteye bak", "baska ulkeye bak" degil.
 */
export const SEARCH_ALL_RADIUS_KM = 150;

/**
 * Varsayılan arama penceresi: yarın 10:00 – +24 saat (çoğu dükkan açık; E2E/seed uyumu).
 */
export function defaultSearchStayWindow(): { checkIn: Date; checkOut: Date } {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 1);
  checkIn.setHours(10, 0, 0, 0);
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
  return { checkIn, checkOut };
}
