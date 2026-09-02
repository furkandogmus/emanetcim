/**
 * Slot üretiminin işleyeceği takvim günleri — DÜKKANIN saat diliminde.
 *
 * NEDEN AYRI VE NEDEN `Date.UTC` (2026-09-02'de ölçüldü): sayaç
 * `dayStart.setDate(dayStart.getDate() + n)` ile yürüyordu, yani `now`a 24
 * SAAT ekleyip sonucu dükkanın diliminde biçimliyordu. 24 saat, bir takvim
 * günü DEĞİLDİR: yaz saati bitişinde gün 25 saat sürer. Sonuç, dükkanın
 * saatinde gün sınırına yakın koşulduğunda ölçüldü:
 *
 *     Europe/Amsterdam, 2026-10-24T22:30Z (dükkanda 00:30), 4 gün:
 *       eski: 2026-10-25  2026-10-25  2026-10-26  2026-10-27
 *       yeni: 2026-10-25  2026-10-26  2026-10-27  2026-10-28
 *
 * Aynısı `America/Los_Angeles`, 1 Kasım geçişinde de çıkıyor.
 *
 * ZARARI ÇİFT SLOT DEĞİL: `ShopTimeSlot` üzerinde `@@unique([shopId,
 * startTime])` var ve üretim `upsert` yapıyor, yani tekrarlanan gün boşa bir
 * tur döner. Zarar penceredeki SON GÜNÜN hiç üretilmemesi -- `daysForward =
 * 30` denen yerde o dükkan 29 günlük slot alır ve otuzuncu gün aramada hiç
 * görünmez. Yılda iki kez, yalnızca cron saati (`17 4 * * *` UTC) dükkanın
 * gün sınırına denk gelen dilimlerde.
 *
 * Takvim günü UTC'de yürütülür, çünkü UTC'de yaz saati yoktur: orada "bir gün
 * sonra" her zaman tam olarak bir takvim günüdür.
 */
export function slotCalendarDays(
  now: Date,
  timeZone: string,
  daysForward: number,
): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yil, ay, gun] = fmt.format(now).split("-").map(Number);

  const gunler: string[] = [];
  for (let i = 0; i < daysForward; i++) {
    gunler.push(new Date(Date.UTC(yil, ay - 1, gun + i)).toISOString().slice(0, 10));
  }
  return gunler;
}
