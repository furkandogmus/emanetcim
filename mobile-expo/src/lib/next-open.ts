import { wallInstant, wallParts } from "./time";

export type NextOpen = { date: string; at: string };

/** Sonraki acilis anini (Istanbul duvar saati) `Date` olarak verir; bozuk girdide null. */
export function nextOpenInstant(n: NextOpen): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(n.date);
  const t = /^(\d{2}):(\d{2})$/.exec(n.at);
  if (!m || !t) return null;
  return wallInstant(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]));
}

/** Aramayi sonraki acilisa kaydirir; ayni sureyi korur (en az 1 saat). */
export function shiftWindowTo(n: NextOpen, checkIn: Date, checkOut: Date): { checkIn: Date; checkOut: Date } | null {
  const start = nextOpenInstant(n);
  if (!start) return null;
  const duration = Math.max(60 * 60_000, checkOut.getTime() - checkIn.getTime());
  return { checkIn: start, checkOut: new Date(start.getTime() + duration) };
}

/** "today" | "tomorrow" | "later": acilis gunu bugune gore nerede (Istanbul gunu). */
export function openDayKind(n: NextOpen, now: Date = new Date()): "today" | "tomorrow" | "later" {
  const p = wallParts(now);
  const key = (d: Date) => {
    const q = wallParts(d);
    return `${q.year}-${String(q.month + 1).padStart(2, "0")}-${String(q.day).padStart(2, "0")}`;
  };
  const today = key(now);
  if (n.date === today) return "today";
  const tomorrow = key(wallInstant(p.year, p.month, p.day + 1, 12));
  return n.date === tomorrow ? "tomorrow" : "later";
}
