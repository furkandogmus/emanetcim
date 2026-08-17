/**
 * Saat dilimi yardımcıları.
 *
 * Neden gerekli: `new Date("2026-06-15T09:00:00")` — offset'siz bir datetime
 * string'i — ECMAScript'e göre **sunucunun yerel saati** olarak yorumlanır.
 * Container UTC ile çalıştığında bu, İstanbul duvar saatinden 3 saat sapar.
 * Aynı şekilde `setHours(9)` de sunucu dilimini kullanır.
 */

/** Verilen anda `timeZone`'un UTC'ye göre farkı (dakika). */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";

  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/**
 * `timeZone` duvar saatindeki bir tarih/saati gerçek UTC anına çevirir.
 *
 * Örn. (2026-06-15 09:00, "Europe/Istanbul") → 2026-06-15T06:00:00Z
 *
 * Ay 1-tabanlıdır (Date.UTC'nin 0-tabanlı ay parametresinden farklı olarak).
 */
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Offset'i hedeflenen anın kendisinden oku; DST sınırlarında ilk tahmin
  // yanlış tarafta kalabileceği için iki geçiş yapılır.
  const firstGuess = naiveUtc - zoneOffsetMinutes(new Date(naiveUtc), timeZone) * 60_000;
  const offset = zoneOffsetMinutes(new Date(firstGuess), timeZone);
  return new Date(naiveUtc - offset * 60_000);
}
