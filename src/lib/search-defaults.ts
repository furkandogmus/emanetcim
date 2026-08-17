import { zoneOffsetMinutes, zonedWallClockToUtc } from '@/lib/timezone';

/** Arama sayfası: varsayılan harita merkezi (İstanbul). */
export const SEARCH_DEFAULT_CENTER = { lat: 41.0256, lng: 28.9741 } as const;

export const SEARCH_NEARBY_RADIUS_KM = 10;

/** Operasyon saat dilimi: dükkan çalışma saatleri bu dilime göre yorumlanır. */
export const SEARCH_TIMEZONE = 'Europe/Istanbul';

/** Varsayılan bırakış saati (SEARCH_TIMEZONE duvar saati). */
const DEFAULT_CHECK_IN_HOUR = 10;

/**
 * Varsayılan arama penceresi: yarın 10:00 – +24 saat (çoğu dükkan açık; E2E/seed uyumu).
 *
 * Saat, sunucunun saat diliminde değil SEARCH_TIMEZONE duvar saatinde hesaplanır:
 * container UTC ile çalıştığında `setHours(10)` İstanbul'da 13:00'a denk geliyordu.
 */
export function defaultSearchStayWindow(): { checkIn: Date; checkOut: Date } {
  const now = new Date();

  // "Şimdi"yi hedef dilimin duvar saatine taşı, böylece gün sınırı doğru bulunur.
  const offset = zoneOffsetMinutes(now, SEARCH_TIMEZONE);
  const zonedNow = new Date(now.getTime() + offset * 60_000);

  const checkIn = zonedWallClockToUtc(
    zonedNow.getUTCFullYear(),
    zonedNow.getUTCMonth() + 1,
    zonedNow.getUTCDate() + 1,
    DEFAULT_CHECK_IN_HOUR,
    0,
    SEARCH_TIMEZONE,
  );
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
  return { checkIn, checkOut };
}
