import {
  PLATFORM_TIMEZONE,
  parseDatetimeLocalInTimeZone,
  toDatetimeLocalValueInTimeZone,
} from "@/lib/datetime-local";
import { MIN_BOOKING_STAY_MS } from "@/lib/booking-server-price";
import { hoursForDate, type ShopSchedule } from "@/lib/shop-schedule";

/**
 * GUN BAZLI REZERVASYON.
 *
 * Misafir yalnizca GUN secer (birakis gunu, alis gunu); saat sorulmaz. Sunucu
 * ise hala bir zaman penceresi ister (kapasite cakismasi, gecikme isi,
 * hatirlatmalar). Pencere dukkanin kendi saatlerinden turetilir:
 *
 *   birakis = secilen gun, dukkanin ACILISI (bugunse: simdi)
 *   alis    = secilen gun, dukkanin KAPANISI
 *
 * Sunucu fiyati `ceil(sure / 24 saat)` ile hesapliyor; bu pencere o formule
 * secilen takvim gunu sayisini verir (ayni gun = 1, ertesi gun = 2). Yani
 * fiyat mantigina dokunmadan "gunluk fiyat" semantigi elde ediliyor.
 */

export type ShopHours = ShopSchedule;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` ya da `YYYY-MM-DDTHH:mm...` -> `YYYY-MM-DD`; gecersizse null. */
export function dateOnlyFromParam(value: string | null | undefined): string | null {
  const v = value?.trim().slice(0, 10);
  if (!v || !DATE_RE.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
    ? v
    : null;
}

/** Verilen saat diliminde bugunun tarihi. */
export function todayInZone(timeZone: string = PLATFORM_TIMEZONE, now: Date = new Date()): string {
  return toDatetimeLocalValueInTimeZone(now, timeZone).slice(0, 10);
}

/** Takvim gunu aritmetigi; saat dilimi/DST'den bagimsiz. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Ayni gun = 1. `pickup` `drop`tan onceyse 0. */
export function calendarDaysInclusive(drop: string, pickup: string): number {
  const a = Date.parse(`${drop}T00:00:00Z`);
  const b = Date.parse(`${pickup}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Dakikayi bir sonraki 5'in katina yuvarlar; "simdi"yi dogrulamanin gecmis saymamasi icin. */
function ceilTo5Min(d: Date): Date {
  const step = 5 * 60_000;
  return new Date(Math.ceil(d.getTime() / step) * step);
}

/**
 * Secilen gunlerden rezervasyon penceresi. Birakis gunu bugunse ve dukkanin
 * kapanmasina bir saatten az kaldiysa (ya da kapandiysa) null: o gun artik
 * birakilamaz.
 */
export function resolveStayWindow(
  drop: string,
  pickup: string,
  shop: ShopHours,
  now: Date = new Date(),
): { checkIn: Date; checkOut: Date } | null {
  if (!dateOnlyFromParam(drop) || !dateOnlyFromParam(pickup)) return null;
  if (calendarDaysInclusive(drop, pickup) < 1) return null;
  const tz = shop.timeZone || PLATFORM_TIMEZONE;
  const dropHours = hoursForDate(shop, drop);
  const pickupHours = hoursForDate(shop, pickup);
  if (!dropHours || !pickupHours) return null;
  const { open } = dropHours;
  const close = pickupHours.close;

  let checkIn = parseDatetimeLocalInTimeZone(`${drop}T${open}`, tz);
  // Gece yarisini asan dukkan (orn. 18:00-02:00): kapanis alis gununun ertesine duser.
  const pickupCloseDay = !shop.open247 && close <= pickupHours.open ? addDays(pickup, 1) : pickup;
  const checkOut = parseDatetimeLocalInTimeZone(`${pickupCloseDay}T${close}`, tz);
  if (!checkIn || !checkOut) return null;

  if (checkIn.getTime() < now.getTime()) {
    // Birakis gunu bugun: dukkan kapanmadan en az yarim saat once gelinebilmeli.
    if (!shop.open247) {
      const dropCloseDay = dropHours.close <= open ? addDays(drop, 1) : drop;
      const dropClose = parseDatetimeLocalInTimeZone(`${dropCloseDay}T${dropHours.close}`, tz);
      if (!dropClose || now.getTime() > dropClose.getTime() - HANDOVER_MARGIN_MS) return null;
    }
    checkIn = ceilTo5Min(now);
  }
  if (checkOut.getTime() - checkIn.getTime() < MIN_BOOKING_STAY_MS) return null;
  return { checkIn, checkOut };
}

/** Bugun birakis icin kapanisa kalmasi gereken en az sure. */
const HANDOVER_MARGIN_MS = 30 * 60_000;

/**
 * Arama penceresi: dukkan saatleri bilinmeden tum gunler. Arama bu modda
 * dukkanin "o anda acik mi" kontrolunu atlar (bkz. `findShopsForSearch`).
 */
export function searchWindowForDays(
  drop: string,
  pickup: string,
  timeZone: string = PLATFORM_TIMEZONE,
  now: Date = new Date(),
): { checkIn: Date; checkOut: Date } | null {
  if (!dateOnlyFromParam(drop) || !dateOnlyFromParam(pickup)) return null;
  if (calendarDaysInclusive(drop, pickup) < 1) return null;
  let checkIn = parseDatetimeLocalInTimeZone(`${drop}T00:00`, timeZone);
  const checkOut = parseDatetimeLocalInTimeZone(`${pickup}T23:59`, timeZone);
  if (!checkIn || !checkOut) return null;
  if (checkIn.getTime() < now.getTime()) checkIn = ceilTo5Min(now);
  if (checkOut.getTime() - checkIn.getTime() < MIN_BOOKING_STAY_MS) return null;
  return { checkIn, checkOut };
}
