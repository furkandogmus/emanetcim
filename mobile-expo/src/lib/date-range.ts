const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export type Picking = "start" | "end";

/**
 * Bir gune dokunmanin yeni araligi. Tek gun seciliyken ILERI bir gune dokunmak
 * araligi o gune uzatir; eskiden yeni tek gun baslatiyordu. Ekran hep bir gun
 * secili acildigi icin misafir "bitis gunune" dokunuyor ve yine tek gun
 * aliyordu: "sadece ayni gun secilebiliyor" (2026-10-18, Play dahili test).
 */
export function nextRange(
  start: Date,
  end: Date,
  day: Date,
  picking: Picking,
  maxDays: number,
): { start: Date; end: Date; picking: Picking } {
  const after = startOfDay(day) > startOfDay(start);
  if (after && (picking === "end" || sameDay(start, end))) {
    const span = (startOfDay(day).getTime() - startOfDay(start).getTime()) / DAY_MS;
    return { start, end: span > maxDays ? new Date(start.getTime() + maxDays * DAY_MS) : day, picking: "start" };
  }
  return { start: day, end: day, picking: "end" };
}
