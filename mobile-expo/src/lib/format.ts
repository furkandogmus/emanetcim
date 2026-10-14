import i18n from "./i18n";

function locale() {
  return i18n.language === "tr" ? "tr-TR" : "en-GB";
}

/**
 * "₺70" / "₺72,50". Simge elle eklenir: Android'deki Hermes Intl
 * `currencyDisplay: "narrowSymbol"`u desteklemiyor ve Ingilizce arayuzde
 * "TRY 70" basiyordu (2026-10-15, emulatorde goruldu).
 */
export function formatMoney(amount: number) {
  const n = new Intl.NumberFormat(locale(), {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `₺${n}`;
}

/** "Cum 16 Eki" */
export function formatDay(d: Date | string) {
  return new Intl.DateTimeFormat(locale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(d));
}

/** "Cum 16 Eki, 10:00" */
export function formatDayTime(d: Date | string) {
  const date = new Date(d);
  return `${formatDay(date)}, ${formatTime(date)}`;
}

export function formatTime(d: Date | string) {
  return new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit" }).format(
    new Date(d),
  );
}

export function formatMonth(d: Date) {
  return new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(d);
}

export function formatKm(km: number) {
  return km < 10 ? km.toFixed(1) : Math.round(km).toString();
}

/** Ucret gun sayisi -- sunucudaki `computeStayDaysFromWindow` ile ayni kural. */
export function stayDays(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
