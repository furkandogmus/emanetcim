import {
  parseDatetimeLocalInTimeZone,
  toDatetimeLocalValueInTimeZone,
} from "@/lib/datetime-local";

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

/** Varsayılan arama penceresinin başlangıç saati, platform saat diliminde. */
const DEFAULT_STAY_START_HOUR = "10:00";

/**
 * Varsayılan arama penceresi: yarın 10:00 – +24 saat (çoğu dükkan açık; E2E/seed uyumu).
 *
 * SAAT PLATFORM DİLİMİNDE ÜRETİLİR, SUNUCUNUNKİNDE DEĞİL (2026-09-02'de
 * düzeltildi). Önceki hâli `checkIn.setHours(10, 0, 0, 0)` diyordu; `setHours`
 * **çalıştığı makinenin** yerel saatini kullanır ve üretim konteynerinde `TZ`
 * tanımlı değil, yani UTC. Sonuç üretimde ölçüldü: arama sayfası "yarın 10:00"
 * demek isterken kullanıcıya **13:00** gösteriyordu (10:00 UTC = 13:00
 * İstanbul).
 *
 * İki ayrı zarar:
 *
 *   - Niyet gerçekleşmiyor. 10:00 seçilmişti çünkü dükkanların çoğu o saatte
 *     açık; gösterilen saat aslında sunucunun ofsetine bağlı bir yan ürün.
 *   - Davranış ORTAM DEĞİŞKENİNE bağlı. Konteynere bir gün `TZ=Europe/Istanbul`
 *     verilirse varsayılan saat sessizce 13:00'ten 10:00'e kayar; hiçbir kod
 *     değişmeden ürün değişir, ve bunu açıklayan hiçbir şey olmaz.
 *
 * Doğru model aynı kod tabanında zaten yazılı (`parseDatetimeLocalInTimeZone`):
 * rezervasyon saatleri DÜKKANIN yerel saatidir, sunucununki ya da cihazınki
 * değil. Niyet tekti, iki yerden yalnızca birinde uygulanmıştı.
 */
export function defaultSearchStayWindow(): { checkIn: Date; checkOut: Date } {
  // Yarının tarihi, platform saat diliminde: gün sınırı da o dilimde geçilmeli
  // -- UTC 23:30'da "yarın" İstanbul'a göre zaten bugündür.
  const yarin = toDatetimeLocalValueInTimeZone(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );
  const gun = yarin.slice(0, 10);
  const checkIn = parseDatetimeLocalInTimeZone(`${gun}T${DEFAULT_STAY_START_HOUR}`);
  /*
    `parseDatetimeLocalInTimeZone` geçersiz girdide `null` döner. Burada girdiyi
    kendimiz kurduğumuz için olamaz, ama tipi daraltmak yerine sessizce `now`a
    düşmek eski hatanın aynısını üretirdi -- bu yüzden açıkça patlıyor.
  */
  if (!checkIn) {
    throw new Error(`defaultSearchStayWindow: gecersiz tarih ${gun}`);
  }
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
  return { checkIn, checkOut };
}
