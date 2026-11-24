import i18n from "./i18n";
import { shiftedForFormat } from "./time";
import { languageInfo } from "./languages";

function locale() {
  return languageInfo(i18n.language).intl;
}

/**
 * Intl bicimleyicisi kurmak Hermes'te pahali; listeler her satirda birkac kez cagiriyor
 * (arama yazilirken 100 satir x 3). Dil + secenek basina bir kez kurulup tutulur.
 */
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function numberFmt(opts: Intl.NumberFormatOptions) {
  const key = `n|${locale()}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) cache.set(key, (f = new Intl.NumberFormat(locale(), opts)));
  return f;
}
function dateFmt(opts: Intl.DateTimeFormatOptions) {
  const key = `d|${locale()}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) cache.set(key, (f = new Intl.DateTimeFormat(locale(), opts)));
  return f;
}

/**
 * "₺70" / "₺72,50". Simge elle eklenir: Android'deki Hermes Intl
 * `currencyDisplay: "narrowSymbol"`u desteklemiyor ve Ingilizce arayuzde
 * "TRY 70" basiyordu (2026-10-15, emulatorde goruldu).
 */
export function formatMoney(amount: number) {
  const n = numberFmt({ minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
  return `₺${n}`;
}

/** "Cum 16 Eki" -- Istanbul gunu, telefonun saat dilimi degil (`time.ts`). */
export function formatDay(d: Date | string) {
  return dateFmt({ weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(shiftedForFormat(d));
}

/** "Cum 16 Eki, 10:00" */
export function formatDayTime(d: Date | string) {
  const date = new Date(d);
  return `${formatDay(date)}, ${formatTime(date)}`;
}

/** Kalis araligi: ayni gun ise yalnizca saatler ("17:30 → 21:30"); tarih tile'da zaten yaziyor. */
export function formatStayRange(checkIn: Date | string, checkOut: Date | string) {
  const sameDay = formatDay(checkIn) === formatDay(checkOut);
  return `${formatTime(checkIn)} → ${sameDay ? formatTime(checkOut) : formatDayTime(checkOut)}`;
}

/** Tarihli kalis: ayni gun ise tarih bir kez ("20 Kas Cum, 08:30 → 12:30"). */
export function formatStayWindow(checkIn: Date | string, checkOut: Date | string) {
  const sameDay = formatDay(checkIn) === formatDay(checkOut);
  return `${formatDayTime(checkIn)}\n→ ${sameDay ? formatTime(checkOut) : formatDayTime(checkOut)}`;
}

export function formatTime(d: Date | string) {
  return dateFmt({ hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(shiftedForFormat(d));
}

/** Takvim hucresi (yerel `Date(y, m, 1)`) alir; saat dilimi kaydirmasi yok. */
export function formatMonth(d: Date) {
  return dateFmt({ month: "long", year: "numeric" }).format(d);
}

/** Ekran okuyucu icin tam tarih ("17 Kasim Pazartesi"); takvim hucresi (yerel `Date`). */
export function formatFullDate(d: Date) {
  return dateFmt({ weekday: "long", day: "numeric", month: "long" }).format(d);
}

/** Mesafe birimiyle: 1 km altinda metre ("0.0 km" yerine "40 m"), 10 m'ye yuvarlanir. */
export function formatDistance(km: number) {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${formatKm(km)} km`;
}

export function formatKm(km: number) {
  // toFixed Turkcede "1.2" basiyordu; ondalik ayirac dile gore.
  return km < 10 ? numberFmt({ maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(km) : String(Math.round(km));
}

/** Ucret gun sayisi -- sunucudaki `computeStayDaysFromWindow` ile ayni kural. */
export function stayDays(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Avatar bas harfi. Ad NFD gelirse ("O" + birlesik nokta) ilk karakter tek basina
 * okunmaz; once NFC, sonra Turkce buyuk harf ("i" -> "I" degil "İ").
 */
export function initial(name: string) {
  const first = [...name.normalize("NFC").trim()][0] ?? "?";
  return first.toLocaleUpperCase("tr-TR");
}

/** "Eki" -- Istanbul gunu icin kisa ay adi (liste gun karosu). */
export function formatMonthShort(d: Date | string) {
  return dateFmt({ month: "short", timeZone: "UTC" }).format(shiftedForFormat(d)).replace(".", "");
}

/** "4,7" -- puan, dilin ondalik ayiraciyla. */
export function formatRating(r: number) {
  return numberFmt({ maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(r);
}

/** Tam sayi, dil ayiriciyla ("12.480" / "12,480"). */
export function formatCount(n: number) {
  return numberFmt({ maximumFractionDigits: 0 }).format(n);
}
