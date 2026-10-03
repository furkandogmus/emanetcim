import { PLATFORM_TIMEZONE, toDatetimeLocalValueInTimeZone } from "@/lib/datetime-local";

/**
 * DUKKAN CALISMA TAKVIMI: haftalik gun bazli saat + esnafin actigi izin araliklari.
 *
 * NEDEN VAR: dukkanin tek bir `openingTime/closingTime` cifti vardi. Pazar kapali,
 * cumartesi kisa mesai ya da bayram izni tanimlanamiyordu; misafir "acik" gorunen
 * bir dukkana valiziyle gidip kapali kapi buluyordu.
 *
 * Oncelik (yuksekten dusuge):
 *   1. Izin araligi (`closures`) o gunu kapatir -- 7/24 dukkan dahil.
 *   2. `open247` -- haftalik satirlari yok sayar.
 *   3. Haftalik satir (`weekly`) -- gun kapali isaretliyse kapali.
 *   4. Eski tek cift (`openingTime/closingTime`) -- haftalik satiri olmayan dukkanlar.
 *
 * Tarihler `YYYY-MM-DD` metni, hafta gunu ISO (1 = Pazartesi ... 7 = Pazar).
 */

export type WeeklyDay = {
  weekday: number;
  isClosed: boolean;
  openingTime: string;
  closingTime: string;
};

export type ClosureRange = { startDate: string; endDate: string };

export type ShopSchedule = {
  open247?: boolean | null;
  openingTime?: string | null;
  closingTime?: string | null;
  timeZone?: string | null;
  weekly?: readonly WeeklyDay[] | null;
  closures?: readonly ClosureRange[] | null;
};

export type DayHours = { open: string; close: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "20:00";

/** Bugun birakis icin kapanisa kalmasi gereken en az sure (dk). */
export const LAST_DROP_OFF_MARGIN_MIN = 30;

function toMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function validTime(value: string | null | undefined, fallback: string): string {
  return value && TIME_RE.test(value) ? value : fallback;
}

/** ISO hafta gunu: 1 = Pazartesi ... 7 = Pazar. Takvim aritmetigi, saat diliminden bagimsiz. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

function previousDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export function closureCovering(
  schedule: ShopSchedule,
  date: string,
): ClosureRange | null {
  return (
    schedule.closures?.find((c) => c.startDate <= date && date <= c.endDate) ?? null
  );
}

/** O gunun acilis/kapanisi; kapaliysa null. Gece yarisini asan dukkanda `close <= open`. */
export function hoursForDate(schedule: ShopSchedule, date: string): DayHours | null {
  if (closureCovering(schedule, date)) return null;
  if (schedule.open247) return { open: "00:00", close: "23:59" };

  const row = schedule.weekly?.find((w) => w.weekday === isoWeekday(date));
  if (row) {
    if (row.isClosed) return null;
    return {
      open: validTime(row.openingTime, DEFAULT_OPEN),
      close: validTime(row.closingTime, DEFAULT_CLOSE),
    };
  }
  return {
    open: validTime(schedule.openingTime, DEFAULT_OPEN),
    close: validTime(schedule.closingTime, DEFAULT_CLOSE),
  };
}

/**
 * Bu AN dukkan acik mi. Bir an iki gunun saatine birden bagli olabilir: dun
 * gece yarisini asan bir vardiya baslattiysa bugunun ilk saatleri dunun.
 */
export function isOpenAt(schedule: ShopSchedule, at: Date): boolean {
  const tz = schedule.timeZone || PLATFORM_TIMEZONE;
  const local = toDatetimeLocalValueInTimeZone(at, tz);
  const date = local.slice(0, 10);
  const mins = toMinutes(local.slice(11, 16));

  const today = hoursForDate(schedule, date);
  if (today) {
    const start = toMinutes(today.open);
    const end = toMinutes(today.close);
    if (start <= end ? mins >= start && mins <= end : mins >= start) return true;
  }

  const yesterday = hoursForDate(schedule, previousDay(date));
  if (yesterday && !schedule.open247) {
    const start = toMinutes(yesterday.open);
    const end = toMinutes(yesterday.close);
    if (end < start && mins <= end) return true;
  }
  return false;
}

/** Teslim anı: kapanıştan sonra `graceMinutes` tolerans (check-in kapısı). */
export function isOpenForHandover(
  schedule: ShopSchedule,
  at: Date,
  graceMinutes = 0,
): boolean {
  if (isOpenAt(schedule, at)) return true;
  return graceMinutes > 0 && isOpenAt(schedule, new Date(at.getTime() - graceMinutes * 60_000));
}

/** Misafire "en gec su saatte birakabilirsin": kapanistan marj kadar once. Kapaliysa null. */
export function lastDropOffForDate(schedule: ShopSchedule, date: string): string | null {
  const hours = hoursForDate(schedule, date);
  if (!hours) return null;
  const end = toMinutes(hours.close) - LAST_DROP_OFF_MARGIN_MIN;
  const start = toMinutes(hours.open);
  // Gece yarisini asan vardiyada kapanis ertesi gundedir; marj 24 saate sarilir.
  const wrapped = ((end % 1440) + 1440) % 1440;
  if (hours.close > hours.open && end < start) return hours.open;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
