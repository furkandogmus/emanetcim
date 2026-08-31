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
