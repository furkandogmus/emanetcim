/** Arama sayfası: varsayılan harita merkezi (İstanbul). */
export const SEARCH_DEFAULT_CENTER = { lat: 41.0256, lng: 28.9741 } as const;

export const SEARCH_NEARBY_RADIUS_KM = 10;

/**
 * Varsayılan arama penceresi: yarın 10:00 – +24 saat (çoğu dükkan açık; E2E/seed uyumu).
 */
export function defaultSearchStayWindow(): { checkIn: Date; checkOut: Date } {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 1);
  checkIn.setHours(10, 0, 0, 0);
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
  return { checkIn, checkOut };
}
