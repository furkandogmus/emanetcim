/** `datetime-local` input value (local wall time, no timezone suffix). */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDatetimeLocal(value: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Platformun iş saati referansı — `isShopOpenAt` ve fiyatlama ile aynı. */
export const PLATFORM_TIMEZONE = "Europe/Istanbul";

/**
 * `datetime-local` değerini BELİRLİ bir saat diliminde üretir.
 *
 * Neden gerekiyor: `toDatetimeLocalValue(new Date())` sunucuda (konteyner UTC) ve
 * istemcide (ziyaretçinin saat dilimi) FARKLI metin üretir. Bu değer bir input'un
 * `value`'su olduğunda React hydration'da metin uyuşmazlığı verir (#418) ve ağacı
 * istemcide baştan render eder — belirtisi titreme ve ilk dokunuşun kaybolması.
 * Ana sayfada tam bu oluyordu.
 *
 * Sabit bir saat dilimi kullanmak hem deterministik hem de bu ürün için doğru:
 * dükkanların açık/kapalı hesabı da (`isShopOpenAt`) aynı referansı kullanıyor,
 * yani kullanıcıya gösterilen varsayılan saat ile müsaitlik hesabı aynı takvimde.
 */
export function toDatetimeLocalValueInTimeZone(
  d: Date,
  timeZone: string = PLATFORM_TIMEZONE,
): string {
  // en-CA + 2 haneli alanlar => "2026-08-22, 14:05" biciminde kararli ciktilar.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  // Intl bazi ortamlarda gece yarisini "24" olarak verir; input "00" bekler.
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Ana sayfa arama kutusunun varsayılan bırakış/alış değerleri (şimdi ve +24 saat),
 * `datetime-local` biçiminde, platform saat diliminde.
 *
 * Neden ayrı bir fonksiyon: `new Date()` / `Date.now()` bir React bileşeninin
 * gövdesinde çağrılınca React Compiler `react-hooks/purity` ile haklı olarak
 * uyarıyor. Zaman okumasını buraya alarak hem o uyarı gideriliyor hem "varsayılan
 * arama penceresi" tanımı tek yerde toplanıyor.
 */
export function defaultStayWindowLocalValues(): {
  checkIn: string;
  checkOut: string;
} {
  const now = new Date();
  const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    checkIn: toDatetimeLocalValueInTimeZone(now),
    checkOut: toDatetimeLocalValueInTimeZone(next),
  };
}
