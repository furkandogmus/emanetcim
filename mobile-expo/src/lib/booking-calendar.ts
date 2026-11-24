import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import * as SecureStore from "expo-secure-store";

/**
 * Rezervasyonu cihaz takvimine iki etkinlik olarak yazar: birakma ve alma, her biri 30 dk
 * once alarmli. iOS'ta yalniz yazma izni istenir (iOS 17+), bu yuzden takvimdeki etkinlik
 * geri okunamaz; cift kaydi onlemek icin olusan kimlikler cihazda saklanir. Saatler
 * degisirse (rezervasyon degisikligi) kayit eskimis sayilir.
 *
 * Yerel modul 0.3.6 ile geldi: yoksa `available()` false doner ve ekran eski Google Takvim
 * baglantisina duser.
 */
type CalendarModule = typeof import("expo-calendar");

function calendarModule(): CalendarModule | null {
  if (!requireOptionalNativeModule("CalendarNext")) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-calendar") as CalendarModule;
}

export function calendarAvailable(): boolean {
  return Platform.OS !== "web" && calendarModule() !== null;
}

export type CalendarBooking = {
  id: string;
  checkInTime: string;
  checkOutTime: string;
  shopAddress?: string | null;
};

export type CalendarCopy = { dropOffTitle: string; pickUpTitle: string; notes: string };

type Saved = { ids: string[]; checkIn: string; checkOut: string };

const EVENT_MINUTES = 30;
const ALARM_MINUTES = 30;
const key = (bookingId: string) => `cal_${bookingId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

async function readSaved(b: CalendarBooking): Promise<Saved | null> {
  const raw = await SecureStore.getItemAsync(key(b.id)).catch(() => null);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Saved;
    return Array.isArray(s.ids) && s.checkIn === b.checkInTime && s.checkOut === b.checkOutTime ? s : null;
  } catch {
    return null;
  }
}

/** Ayni saatlerle daha once eklendi mi (cihaz kaydina gore). */
export async function isInCalendar(b: CalendarBooking): Promise<boolean> {
  return (await readSaved(b)) !== null;
}

export type AddResult = "added" | "denied" | "no-calendar";

export function eventWindows(b: CalendarBooking): { start: Date; end: Date }[] {
  return [b.checkInTime, b.checkOutTime].map((t) => {
    const start = new Date(t);
    return { start, end: new Date(start.getTime() + EVENT_MINUTES * 60_000) };
  });
}

/** Izin yalnizca burada, dokununca istenir. */
export async function addBookingToCalendar(b: CalendarBooking, copy: CalendarCopy): Promise<AddResult> {
  const Cal = calendarModule();
  if (!Cal) return "no-calendar";
  const perm = await Cal.requestCalendarPermissions(true);
  if (!perm.granted) return "denied";

  let calendar: InstanceType<CalendarModule["ExpoCalendar"]> | undefined;
  if (Platform.OS === "ios") {
    calendar = Cal.getDefaultCalendarSync();
  } else {
    // Android'de tek bir varsayilan takvim yok: yazilabilir birincil, yoksa ilk yazilabilir.
    const all = await Cal.getCalendars();
    const writable = all.filter((c) => c.allowsModifications);
    calendar = writable.find((c) => c.isPrimary) ?? writable[0];
  }
  if (!calendar) return "no-calendar";

  const [drop, pick] = eventWindows(b);
  const common = {
    location: b.shopAddress ?? undefined,
    notes: copy.notes,
    alarms: [{ relativeOffset: -ALARM_MINUTES }],
  };
  const created = [
    await calendar.createEvent({ ...common, title: copy.dropOffTitle, startDate: drop.start, endDate: drop.end }),
    await calendar.createEvent({ ...common, title: copy.pickUpTitle, startDate: pick.start, endDate: pick.end }),
  ];
  const saved: Saved = { ids: created.map((e) => e.id), checkIn: b.checkInTime, checkOut: b.checkOutTime };
  await SecureStore.setItemAsync(key(b.id), JSON.stringify(saved)).catch(() => undefined);
  return "added";
}
