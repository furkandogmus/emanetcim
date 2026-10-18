/**
 * Duvar saati her zaman platform saatidir (Europe/Istanbul), telefonunki degil.
 * Sunucu acilis saatlerini ve gunleri dukkanin saatiyle olcer
 * (`src/lib/datetime-local.ts` -> PLATFORM_TIMEZONE); Londra saatindeki bir
 * telefonla 18:00 secen misafir yoksa 20:00 TRT'ye rezervasyon yapiyordu.
 *
 * Sabit +03:00: Turkiye 2016'dan beri yaz saati uygulamiyor. Hermes'in Intl
 * `timeZone` destegine guvenmek yerine anlar kaydirilip UTC alanlariyla okunur.
 * Rezervasyon alan butun noktalar Turkiye'de; Paris noktalari yalnizca talep testi.
 */
const OFFSET_MS = 3 * 60 * 60 * 1000;

export type WallParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** Bir anin Istanbul'daki takvim ve saat alanlari (ay 0 tabanli, pazar = 0). */
export function wallParts(d: Date | string): WallParts {
  const x = new Date(new Date(d).getTime() + OFFSET_MS);
  return {
    year: x.getUTCFullYear(),
    month: x.getUTCMonth(),
    day: x.getUTCDate(),
    hour: x.getUTCHours(),
    minute: x.getUTCMinutes(),
    weekday: x.getUTCDay(),
  };
}

/** Istanbul'daki duvar saatinin karsiligi olan an. Tasan alanlar (gun 32) normalize olur. */
export function wallInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS);
}

/** Ayni anin ayni gun icindeki baska bir saati. */
export function atWallMinutes(d: Date, minutes: number): Date {
  const p = wallParts(d);
  return wallInstant(p.year, p.month, p.day, Math.floor(minutes / 60), minutes % 60);
}

export function wallMinutes(d: Date): number {
  const p = wallParts(d);
  return p.hour * 60 + p.minute;
}

export function sameWallDay(a: Date, b: Date): boolean {
  const x = wallParts(a);
  const y = wallParts(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/**
 * Takvim hucresi: telefonun yerel gece yarisinda duran, Istanbul gununu tasiyan
 * Date. Takvim izgarasi yerel `Date(y, m, d)` ile kuruldugu icin hucreler bu
 * bicimde karsilastirilir; anlara `fromCell` ile geri donulur.
 */
export function cellOf(d: Date): Date {
  const p = wallParts(d);
  return new Date(p.year, p.month, p.day);
}

export function fromCell(cell: Date, minutes = 0): Date {
  return wallInstant(cell.getFullYear(), cell.getMonth(), cell.getDate(), Math.floor(minutes / 60), minutes % 60);
}

/** Istanbul saatiyle bicimlendirmek icin: kaydirilmis an + `timeZone: "UTC"`. */
export function shiftedForFormat(d: Date | string): Date {
  return new Date(new Date(d).getTime() + OFFSET_MS);
}
