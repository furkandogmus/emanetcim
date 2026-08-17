/** Arama sayfası: varsayılan harita merkezi (İstanbul). */
export const SEARCH_DEFAULT_CENTER = { lat: 41.0256, lng: 28.9741 } as const;

export const SEARCH_NEARBY_RADIUS_KM = 10;

/** Operasyon saat dilimi: dükkan çalışma saatleri bu dilime göre yorumlanır. */
export const SEARCH_TIMEZONE = 'Europe/Istanbul';

/** Varsayılan bırakış saati (SEARCH_TIMEZONE duvar saati). */
const DEFAULT_CHECK_IN_HOUR = 10;

/**
 * Verilen anda `timeZone`'un UTC'ye göre farkını dakika olarak döndürür.
 * (Europe/Istanbul 2016'dan beri sabit +03:00, ama fark hesabı yine de dinamik.)
 */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';

  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/**
 * Varsayılan arama penceresi: yarın 10:00 – +24 saat (çoğu dükkan açık; E2E/seed uyumu).
 *
 * Saat, sunucunun saat diliminde değil SEARCH_TIMEZONE duvar saatinde hesaplanır:
 * container UTC ile çalıştığında `setHours(10)` İstanbul'da 13:00'a denk geliyordu.
 */
export function defaultSearchStayWindow(): { checkIn: Date; checkOut: Date } {
  const now = new Date();
  const offset = zoneOffsetMinutes(now, SEARCH_TIMEZONE);

  // "Şimdi"yi hedef dilimin duvar saatine taşı, böylece gün sınırı doğru bulunur.
  const zonedNow = new Date(now.getTime() + offset * 60_000);
  const wallClockTomorrow = Date.UTC(
    zonedNow.getUTCFullYear(),
    zonedNow.getUTCMonth(),
    zonedNow.getUTCDate() + 1,
    DEFAULT_CHECK_IN_HOUR,
  );

  const checkIn = new Date(wallClockTomorrow - offset * 60_000);
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
  return { checkIn, checkOut };
}
