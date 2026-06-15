/**
 * Basit çalışma saati kontrolü (HH:mm string, 24 saat).
 */
function parseHm(s: string | null | undefined): { h: number; m: number } | null {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s.trim())) return null;
  const [h, m] = s.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function isShopOpenAt(
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
  at: Date,
  timezone = "Europe/Istanbul",
): boolean {
  const localeTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).format(at);

  const [h, m] = localeTime.split(":").map(Number);
  const mins = h * 60 + m;

  const open = parseHm(openingTime) ?? { h: 0, m: 0 };
  const close = parseHm(closingTime) ?? { h: 23, m: 59 };
  
  const start = open.h * 60 + open.m;
  const end = close.h * 60 + close.m;
  
  if (start <= end) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

/**
 * Check if shop is open across the full stay window.
 * Validates at least check-in, check-out, and midpoint.
 */
export function isShopOpenForStay(
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
  open247: boolean | null | undefined,
  checkIn: Date,
  checkOut: Date,
  timezone = "Europe/Istanbul",
): boolean {
  if (open247) return true;

  // Check endpoints
  if (!isShopOpenAt(openingTime, closingTime, checkIn, timezone)) return false;
  if (!isShopOpenAt(openingTime, closingTime, checkOut, timezone)) return false;

  // Check midpoint for overnight stays
  const midpoint = new Date((checkIn.getTime() + checkOut.getTime()) / 2);
  if (!isShopOpenAt(openingTime, closingTime, midpoint, timezone)) return false;

  return true;
}
