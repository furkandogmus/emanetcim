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
  at: Date
): boolean {
  const open = parseHm(openingTime) ?? { h: 0, m: 0 };
  const close = parseHm(closingTime) ?? { h: 23, m: 59 };
  const mins = at.getHours() * 60 + at.getMinutes();
  const start = open.h * 60 + open.m;
  const end = close.h * 60 + close.m;
  if (start <= end) return mins >= start && mins <= end;
  // gece sarkan (ör. 22:00–02:00)
  return mins >= start || mins <= end;
}
