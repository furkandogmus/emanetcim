/**
 * Bir saat dilimindeki GÜNÜN BAŞLANGICI, UTC anı olarak.
 *
 * NEDEN VAR (2026-08-31'de ölçüldü): "bugünkü kazanç" hesapları
 * `today.setHours(0, 0, 0, 0)` ile yazılmıştı. Bu, SUNUCUNUN yerel saatinde gece
 * yarısını bulur. Üretim konteyneri UTC çalışıyor, yani İstanbul'daki bir esnaf
 * için "bugün" saat **03:00'te** başlıyordu:
 *
 *   - Gece 00:00–03:00 arasında bakan esnaf, DÜNÜN akşam rezervasyonlarını
 *     "bugün" sütununda görüyordu.
 *   - Sabah baktığında ise günün ilk üç saati eksikti.
 *
 * `Shop.timezone` alanı zaten var; eksik olan tek şey onu kullanmaktı.
 */

/**
 * `tz` saat diliminin verilen ANDAKİ UTC farkı (milisaniye).
 *
 * Yaz saati uygulaması yüzünden fark SABİT DEĞİLDİR — bu yüzden sorulan an
 * parametredir. `Intl` verinin tek güvenilir kaynağı; elle tablo tutmak DST
 * geçişlerinde sessizce yanlışa düşer.
 */
function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  // `hour` bazı ortamlarda gece yarısını 24 olarak verir; 0'a indirilmezse
  // gün bir ileri kayar.
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}

/**
 * `timeZone` içinde `now`un ait olduğu günün 00:00'ı — UTC `Date` olarak.
 *
 * Prisma `DateTime` alanları UTC tuttuğu için sorgu sınırı da UTC olmalıdır;
 * dönen değer doğrudan `{ gte: ... }` içine konulabilir.
 */
export function startOfDayInTimeZone(timeZone: string, now: Date = new Date()): Date {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = local.split("-").map(Number);

  /*
    Iki adim: once o yerel tarihin 00:00'ini UTC'ymis gibi kur, sonra O ANDAKI
    farki cikar. Fark, gunun kendisine gore hesaplanir -- DST gecisinin oldugu
    gunlerde sabit bir fark varsaymak bir saatlik kayma uretir.
  */
  const naiveMidnight = Date.UTC(year, month - 1, day);
  return new Date(naiveMidnight - offsetMs(timeZone, new Date(naiveMidnight)));
}

/**
 * `timeZone` içinde `now`un ait olduğu GÜNÜN yarı açık aralığı: `[start, end)`.
 *
 * `end` HESAPLANMAZ, ARANIR. "Başlangıç + 24 saat" demek yaz saati geçişinin
 * olduğu günlerde bir saat kaydırır (o gün 23 ya da 25 saattir) ve gecenin son
 * saatindeki rezervasyon ya iki güne birden ya da hiçbirine düşer. Bunun yerine
 * kesinlikle ertesi güne düşen bir ana (+36 saat) bakılıp O GÜNÜN başlangıcı
 * alınıyor — DST ne yaparsa yapsın sınır doğru yerde durur.
 */
export function dayRangeInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const start = startOfDayInTimeZone(timeZone, now);
  const end = startOfDayInTimeZone(
    timeZone,
    new Date(start.getTime() + 36 * 60 * 60 * 1000),
  );
  return { start, end };
}

/**
 * `timeZone` içinde `now`un ait olduğu AYIN yarı açık aralığı: `[start, end)`.
 * `monthsAgo` ile geriye gidilir (1 = geçen ay).
 */
export function monthRangeInTimeZone(
  timeZone: string,
  now: Date = new Date(),
  monthsAgo = 0,
): { start: Date; end: Date } {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);

  // Ayin ilk gununun 00:00'i; `Date.UTC` ay tasmasini kendisi cozer (0 -> Aralik).
  const firstOf = (offset: number) =>
    startOfDayInTimeZone(
      timeZone,
      // Ayin 15'i: DST gecisleri ve ay uzunlugu ne olursa olsun o ayin icinde kalir.
      new Date(Date.UTC(year, month - 1 + offset, 15, 12)),
    );
  const startOfMonth = (offset: number) => {
    const mid = firstOf(offset);
    const [y, m] = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    })
      .format(mid)
      .split("-")
      .map(Number);
    return startOfDayInTimeZone(timeZone, new Date(Date.UTC(y, m - 1, 1, 12)));
  };

  return { start: startOfMonth(-monthsAgo), end: startOfMonth(-monthsAgo + 1) };
}
