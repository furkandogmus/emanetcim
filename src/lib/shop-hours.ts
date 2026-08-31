/**
 * Basit çalışma saati kontrolü (HH:mm string, 24 saat).
 */
function parseHm(s: string | null | undefined): { h: number; m: number } | null {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s.trim())) return null;
  const [h, m] = s.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function isShopOpenAt(
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
  at: Date,
  timezone = "Europe/Istanbul",
): boolean {
  const localeTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).format(at);

  const [h, m] = localeTime.split(":").map(Number);
  const mins = h * 60 + m;

  const open = parseHm(openingTime) ?? { h: 0, m: 0 };
  const close = parseHm(closingTime) ?? { h: 23, m: 59 };
  
  const start = open.h * 60 + open.m;
  const end = close.h * 60 + close.m;
  
  if (start <= end) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

/**
 * Bagaj emaneti bir "vale" hizmetidir: dükkanın valizi teslim aldığı ve geri
 * verdiği anlarda açık olması yeterli ve gereklidir. Emanet süresince (gece
 * boyunca dahi) dükkanın fiziksen açık kalması gerekmez — valiz kilitli
 * alanda bekler. Bu yüzden burada sadece check-in ve check-out anları
 * kontrol edilir; bir "midpoint" kontrolü 7/24 açık olmayan (yani neredeyse
 * tüm) dükkanları gece aşan her aramada elenmiş gösterirdi.
 */
export function isShopOpenForStay(
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
  open247: boolean | null | undefined,
  checkIn: Date,
  checkOut: Date,
  timezone = "Europe/Istanbul",
): boolean {
  if (open247) return true;

  if (!isShopOpenAt(openingTime, closingTime, checkIn, timezone)) return false;
  if (!isShopOpenAt(openingTime, closingTime, checkOut, timezone)) return false;

  return true;
}

/**
 * Valizin EL DEĞİŞTİRDİĞİ an dükkan açık mı — check-in kapısının sorduğu soru.
 *
 * NEDEN AYRI BİR FONKSİYON: `check-in.ts` doğrudan `isShopOpenAt`i çağırıyordu
 * ve iki alanı sessizce düşürüyordu:
 *
 *   1. `open247`. `isShopOpenForStay` (arama ve rezervasyon) 24/7 dükkanda
 *      kısa devre yapıp TRUE dönüyor; `isShopOpenAt`in böyle bir parametresi
 *      yok. Yani `open247 = true` ama `openingTime/closingTime` şema
 *      varsayılanında (09:00–20:00) kalmış bir dükkan, aramada 22:00 slotunu
 *      SATIYOR, misafir geliyor ve tezgâhta check-in REDDEDİLİYOR.
 *   2. Saat dilimi. `isShopOpenAt`in varsayılanı `Europe/Istanbul`; çağrı
 *      dükkanın `timezone` alanını hiç geçmiyordu. Tokyo'daki bir dükkan
 *      İstanbul duvar saatine göre değerlendiriliyordu.
 *
 * `isShopOpenForStay` ile AYNI ŞEKİLDE yazıldı (önce `open247`, sonra saat
 * kontrolü) ki ikisi bir daha ayrışmasın: aynı soruyu iki farklı yerde iki
 * farklı şekilde cevaplamak, bu hatanın kaynağıydı.
 */
export function isShopOpenForHandover(
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
  open247: boolean | null | undefined,
  at: Date,
  timezone = "Europe/Istanbul",
  /**
   * Kapanış saatine tanınan tolerans (dakika) — `PlatformSettings.checkInGraceMin`.
   *
   * NEDEN VAR: misafir çalışma saati İÇİNDE bir bırakış saati seçip rezervasyon
   * yapıyor, ama birkaç dakika geç geliyor. Esnaf tezgahta, misafir karşısında,
   * ikisi de razı — ve sistem valizi reddediyordu. Ret, misafiri valiziyle
   * sokakta bırakır; kabul, esnafın zaten orada olduğu bir anda tek bir işlem
   * yapmasını sağlar.
   *
   * Yalnızca KAPANIŞ tarafına uygulanır. Açılıştan önce gelen misafir için
   * tolerans anlamsız: dükkan henüz açılmamıştır, esnaf orada değildir.
   */
  graceMinutes = 0,
): boolean {
  if (open247) return true;
  if (isShopOpenAt(openingTime, closingTime, at, timezone)) return true;
  if (graceMinutes <= 0) return false;

  /*
    Tolerans "kapanıştan bu kadar dakika önceymiş gibi davran" demek: `at`i
    geriye alıp aynı kontrolü tekrarlıyoruz. Kapanış saatini ileri kaydırmak
    yerine saati geri almak, gece yarısını aşan çalışma saatlerini
    (`22:00–04:00`) de bozmadan çalışır -- `isShopOpenAt` o durumu zaten
    doğru ele alıyor.
  */
  const shifted = new Date(at.getTime() - graceMinutes * 60_000);
  return isShopOpenAt(openingTime, closingTime, shifted, timezone);
}
