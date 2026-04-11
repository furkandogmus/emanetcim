const DAY_MS = 24 * 60 * 60 * 1000;

export function getBookingCalendarTimeZone(): string {
  return (
    process.env.BOOKING_CALENDAR_TIMEZONE?.trim() || "Europe/Istanbul"
  );
}

export function parsePlatformHolidayDates(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string =>
      typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x),
  );
}

/**
 * [checkIn, checkOut) aralığında takvim günleri (TZ duyarlı YYYY-MM-DD).
 */
export function calendarDatesInBookingWindow(
  checkIn: Date,
  checkOut: Date,
  timeZone: string,
): string[] {
  const out: string[] = [];
  let t = checkIn.getTime();
  const end = checkOut.getTime();
  while (t < end) {
    const d = new Date(t);
    out.push(d.toLocaleDateString("en-CA", { timeZone }));
    t += DAY_MS;
  }
  return out;
}

export function bookingTouchesPlatformHoliday(
  checkIn: Date,
  checkOut: Date,
  holidays: string[],
  timeZone?: string,
): boolean {
  if (holidays.length === 0) return false;
  const tz = timeZone ?? getBookingCalendarTimeZone();
  const set = new Set(holidays);
  return calendarDatesInBookingWindow(checkIn, checkOut, tz).some((d) =>
    set.has(d),
  );
}
