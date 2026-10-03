import prisma from "@/lib/db";
import { PLATFORM_TIMEZONE, toDatetimeLocalValueInTimeZone } from "@/lib/datetime-local";
import { hoursForDate, type ClosureRange, type ShopSchedule, type WeeklyDay } from "@/lib/shop-schedule";

export type ShopScheduleParts = { weekly: WeeklyDay[]; closures: ClosureRange[] };

/** Birden çok dükkanın haftalık saati + izinleri; dükkan sayısından bağımsız iki sorgu. */
export async function loadScheduleParts(
  shopIds: string[],
  fromDate?: string,
): Promise<Map<string, ShopScheduleParts>> {
  const out = new Map<string, ShopScheduleParts>();
  if (shopIds.length === 0) return out;

  const [weekly, closures] = await Promise.all([
    prisma.shopWeeklyHours.findMany({
      where: { shopId: { in: shopIds } },
      orderBy: { weekday: "asc" },
    }),
    prisma.shopClosure.findMany({
      where: { shopId: { in: shopIds }, ...(fromDate ? { endDate: { gte: fromDate } } : {}) },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const entry = (id: string) => {
    let e = out.get(id);
    if (!e) out.set(id, (e = { weekly: [], closures: [] }));
    return e;
  };
  for (const w of weekly) {
    entry(w.shopId).weekly.push({
      weekday: w.weekday,
      isClosed: w.isClosed,
      openingTime: w.openingTime,
      closingTime: w.closingTime,
    });
  }
  for (const c of closures) {
    entry(c.shopId).closures.push({ startDate: c.startDate, endDate: c.endDate });
  }
  return out;
}

export type ScheduleConflict = {
  bookingId: string;
  guestName: string | null;
  date: string;
  kind: "dropoff" | "pickup" | "bags_on_shelf";
};

const ACTIVE_STATUSES = ["PAID", "APPROVED", "CHECKED_IN"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Yeni takvimin kapattığı güne denk gelen aktif rezervasyonlar. Boş liste = güvenli.
 * Rafta valizi (CHECKED_IN) olan dükkan, izin aralığı boyunca kapanamaz.
 */
export async function findScheduleConflicts(
  shopId: string,
  next: ShopSchedule,
  now: Date = new Date(),
): Promise<ScheduleConflict[]> {
  const tz = next.timeZone || PLATFORM_TIMEZONE;
  const bookings = await prisma.booking.findMany({
    where: { shopId, status: { in: [...ACTIVE_STATUSES] }, checkOutTime: { gte: now } },
    select: {
      id: true,
      status: true,
      guestEmail: true,
      guest: { select: { name: true, email: true } },
      checkInTime: true,
      checkOutTime: true,
    },
    orderBy: { checkInTime: "asc" },
    take: 500,
  });

  const out: ScheduleConflict[] = [];
  const localDate = (d: Date) => toDatetimeLocalValueInTimeZone(d, tz).slice(0, 10);
  for (const b of bookings) {
    const pickup = localDate(b.checkOutTime);
    const add = (date: string, kind: ScheduleConflict["kind"]) =>
      out.push({ bookingId: b.id, guestName: b.guest?.name ?? b.guest?.email ?? b.guestEmail ?? null, date, kind });

    if (b.status === "CHECKED_IN") {
      const closed = next.closures?.find((c) => c.endDate >= localDate(now) && c.startDate <= pickup);
      if (closed) add(closed.startDate > localDate(now) ? closed.startDate : localDate(now), "bags_on_shelf");
    } else if (b.checkInTime >= now) {
      const drop = localDate(b.checkInTime);
      if (!hoursForDate(next, drop)) add(drop, "dropoff");
    }
    if (!hoursForDate(next, pickup)) add(pickup, "pickup");
  }
  return out;
}

export type SaveScheduleResult =
  | { ok: true }
  | { ok: false; code: "INVALID" | "CONFLICT"; conflicts?: ScheduleConflict[] };

async function currentSchedule(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { open247: true, openingTime: true, closingTime: true, timezone: true },
  });
  if (!shop) return null;
  const parts = (await loadScheduleParts([shopId])).get(shopId);
  return {
    open247: shop.open247,
    openingTime: shop.openingTime,
    closingTime: shop.closingTime,
    timeZone: shop.timezone,
    weekly: parts?.weekly ?? [],
    closures: parts?.closures ?? [],
  } satisfies ShopSchedule;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveWeeklyHours(
  shopId: string,
  days: WeeklyDay[],
): Promise<SaveScheduleResult> {
  const valid =
    days.length === 7 &&
    new Set(days.map((d) => d.weekday)).size === 7 &&
    days.every(
      (d) =>
        d.weekday >= 1 &&
        d.weekday <= 7 &&
        (d.isClosed || (TIME_RE.test(d.openingTime) && TIME_RE.test(d.closingTime))),
    );
  if (!valid) return { ok: false, code: "INVALID" };

  const current = await currentSchedule(shopId);
  if (!current) return { ok: false, code: "INVALID" };
  const conflicts = await findScheduleConflicts(shopId, { ...current, weekly: days });
  if (conflicts.length > 0) return { ok: false, code: "CONFLICT", conflicts };

  const firstOpen = days.find((d) => !d.isClosed);
  await prisma.$transaction([
    prisma.shopWeeklyHours.deleteMany({ where: { shopId } }),
    prisma.shopWeeklyHours.createMany({
      data: days.map((d) => ({
        shopId,
        weekday: d.weekday,
        isClosed: d.isClosed,
        openingTime: TIME_RE.test(d.openingTime) ? d.openingTime : "09:00",
        closingTime: TIME_RE.test(d.closingTime) ? d.closingTime : "20:00",
      })),
    }),
    // Eski tek çifti okuyan yüzeyler (JSON-LD, mobil DTO) için ilk açık günün saati.
    ...(firstOpen
      ? [
          prisma.shop.update({
            where: { id: shopId },
            data: { openingTime: firstOpen.openingTime, closingTime: firstOpen.closingTime },
          }),
        ]
      : []),
  ]);
  return { ok: true };
}

export async function addClosure(
  shopId: string,
  range: { startDate: string; endDate: string; reason?: string | null },
  now: Date = new Date(),
): Promise<SaveScheduleResult> {
  const { startDate, endDate } = range;
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) {
    return { ok: false, code: "INVALID" };
  }
  const current = await currentSchedule(shopId);
  if (!current) return { ok: false, code: "INVALID" };
  if (endDate < toDatetimeLocalValueInTimeZone(now, current.timeZone).slice(0, 10)) {
    return { ok: false, code: "INVALID" };
  }

  const conflicts = await findScheduleConflicts(
    shopId,
    { ...current, closures: [...current.closures, { startDate, endDate }] },
    now,
  );
  if (conflicts.length > 0) return { ok: false, code: "CONFLICT", conflicts };

  await prisma.shopClosure.create({
    data: { shopId, startDate, endDate, reason: range.reason?.trim().slice(0, 200) || null },
  });
  return { ok: true };
}

export async function removeClosure(shopId: string, closureId: string): Promise<void> {
  await prisma.shopClosure.deleteMany({ where: { id: closureId, shopId } });
}
