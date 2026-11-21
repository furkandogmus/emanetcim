import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { generateSlotsForShop } from "@/services/SlotService";
import { PLATFORM_TIMEZONE, toDatetimeLocalValueInTimeZone } from "@/lib/datetime-local";
import { getPricingRules } from "@/lib/platform-settings";
import {
  hoursForDate,
  isOpenAt,
  isOpenForHandover,
  type ClosureRange,
  type ShopSchedule,
  type WeeklyDay,
} from "@/lib/shop-schedule";

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
 * Yeni takvimin kapattığı güne ya da SAATE denk gelen aktif rezervasyonlar.
 * Boş liste = güvenli. Rafta valizi (CHECKED_IN) olan dükkan, izin aralığı
 * boyunca kapanamaz.
 *
 * SAAT KONTROLU (bulgu 67): eskiden yalnizca "gun kapali mi" soruluyordu.
 * Kapanisi 22:00'den 18:00'e ceken esnaf uyarilmiyordu; 20:00'de birakacak
 * kabul edilmis misafir tezgahta `SHOP_CLOSED` ile geri donuyordu. Artik
 * birakis/alis ANI, check-in kapisinin kullandigi `isOpenForHandover` (ayni
 * tolerans) ile yeni takvime karsi sinanir. Web ve mobil ayni servisi cagirir.
 *
 * `current` verilirse yalnizca BU degisikligin kapattigi an sayilir: bugunku
 * takvimde de saat disinda kalan eski bir kayit, ilgisiz bir duzenlemeyi
 * sonsuza kadar kilitlemesin. Tur adlari (`dropoff`/`pickup`) bilerek ayni:
 * eski uygulama surumleri yeni bir turu cevirmeden gosterirdi.
 */
export async function findScheduleConflicts(
  shopId: string,
  next: ShopSchedule,
  now: Date = new Date(),
  opts: { current?: ShopSchedule; graceMinutes?: number } = {},
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
  const grace = opts.graceMinutes ?? 0;
  const strandedAt = (at: Date) =>
    !isOpenForHandover(next, at, grace) && (!opts.current || isOpenForHandover(opts.current, at, grace));
  for (const b of bookings) {
    const pickup = localDate(b.checkOutTime);
    const add = (date: string, kind: ScheduleConflict["kind"]) =>
      out.push({ bookingId: b.id, guestName: b.guest?.name ?? b.guest?.email ?? b.guestEmail ?? null, date, kind });

    if (b.status === "CHECKED_IN") {
      const closed = next.closures?.find((c) => c.endDate >= localDate(now) && c.startDate <= pickup);
      if (closed) add(closed.startDate > localDate(now) ? closed.startDate : localDate(now), "bags_on_shelf");
    } else if (b.checkInTime >= now) {
      const drop = localDate(b.checkInTime);
      if (!hoursForDate(next, drop) || strandedAt(b.checkInTime)) add(drop, "dropoff");
    }
    if (!hoursForDate(next, pickup) || strandedAt(b.checkOutTime)) add(pickup, "pickup");
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

/** Check-in kapisinin kapanis toleransi; okunamazsa 0 (daha siki, hic gevsemez). */
async function handoverGraceMinutes(): Promise<number> {
  try {
    return (await getPricingRules()).checkInGraceMin;
  } catch (err) {
    logger.warn({ err }, "schedule_conflict_grace_read_failed");
    return 0;
  }
}

export async function saveWeeklyHours(
  shopId: string,
  days: WeeklyDay[],
  open247: boolean,
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
  const conflicts = await findScheduleConflicts(shopId, { ...current, weekly: days, open247 }, new Date(), {
    current,
    graceMinutes: await handoverGraceMinutes(),
  });
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
    prisma.shop.update({
      where: { id: shopId },
      data: {
        open247,
        ...(firstOpen
          ? { openingTime: firstOpen.openingTime, closingTime: firstOpen.closingTime }
          : {}),
      },
    }),
  ]);
  // Yeni acilan gunlerin slotu cron'u (04:17) beklemesin; hata cron'a kalir.
  generateSlotsForShop(shopId).catch((err: unknown) =>
    logger.warn({ err, shopId }, "save_weekly_hours_slot_generation_failed"),
  );
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
    { current, graceMinutes: await handoverGraceMinutes() },
  );
  if (conflicts.length > 0) return { ok: false, code: "CONFLICT", conflicts };

  await prisma.shopClosure.create({
    data: { shopId, startDate, endDate, reason: range.reason?.trim().slice(0, 200) || null },
  });
  return { ok: true };
}

export async function removeClosure(shopId: string, closureId: string): Promise<void> {
  await prisma.shopClosure.deleteMany({ where: { id: closureId, shopId } });
  // Kapanis kalkinca o gunlerin slotu cron'u beklemeden uretilir.
  generateSlotsForShop(shopId).catch((err: unknown) =>
    logger.warn({ err, shopId }, "remove_closure_slot_generation_failed"),
  );
}

/**
 * Birakis ya da alis gunu dukkan kapaliysa o gun (`YYYY-MM-DD`), degilse null.
 * Istemci pencereyi kendisi kurdugu icin son savunma sunucuda.
 */
/**
 * Birakis ya da alis ANINDA dukkan kapali mi (gun acik ama saat disi). Gun
 * kapisi (`findClosedStayDay`) yalnizca gune bakiyordu: 20:00'de kapanan
 * dukkana 23:00 alis kabul ediliyordu. Mobil odeme saati zaten oturtuyor;
 * bu kapi web, mobil degisiklik ve dogrudan cagrilar icin.
 */
export async function isClosedAtStayTimes(shopId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
  const current = await currentSchedule(shopId);
  if (!current || current.open247) return false;
  return !isOpenAt(current, checkIn) || !isOpenAt(current, checkOut);
}

export async function findClosedStayDay(
  shopId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<string | null> {
  const current = await currentSchedule(shopId);
  if (!current) return null;
  const tz = current.timeZone || PLATFORM_TIMEZONE;
  for (const at of [checkIn, checkOut]) {
    const date = toDatetimeLocalValueInTimeZone(at, tz).slice(0, 10);
    if (!hoursForDate(current, date)) return date;
  }
  return null;
}
