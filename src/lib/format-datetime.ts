import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";

/**
 * Bir anı BELİRLİ bir saat diliminde biçimlendirir.
 *
 * NEDEN VAR (2026-09-02'de ölçüldü): sunucuda çalışan kod tarihleri
 * `d.toLocaleString("tr-TR")` ile biçimlendiriyordu. `timeZone` verilmediğinde
 * `Intl` **süreci çalıştıran makinenin** saat dilimini kullanır; üretim
 * konteynerinde `TZ` tanımlı değil, yani UTC. İstanbul'da saat 13:00 olan bir
 * check-in, misafire giden hatırlatma e-postasında **10:00** yazıyordu.
 *
 * Üç yüzeyde birden yanlıştı ve üçü de kullanıcıya bir SAAT SÖZÜ veriyor:
 * hatırlatma e-postaları, esnafın rezervasyon listesi, misafirin rezervasyon
 * detayı. Kimsenin cihazı UTC değil, dolayısıyla bu hiçbir okuyucu için doğru
 * değildi.
 *
 * `timeZone` bu yüzden ZORUNLU parametre: unutulabilir bir seçenek olduğu
 * sürece yeniden unutulur. Doğru değer rezervasyonun dükkanının saat dilimidir
 * (`bookingTimeZone`) -- `parseDatetimeLocalInTimeZone`in 2026-08-22'de
 * yazdığı kuralın aynısı: "rezervasyon saatleri DÜKKANIN yerel saatidir".
 */
export function formatDateTimeInZone(
  date: Date | string,
  opts: {
    locale: string;
    timeZone: string;
    dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
    timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
  },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const { locale, timeZone, dateStyle = "short", timeStyle } = opts;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle,
    ...(timeStyle ? { timeStyle } : {}),
  }).format(d);
}

/** Yalnızca tarih -- gün sınırı da dükkanın diliminde geçmeli. */
export function formatDateInZone(
  date: Date | string,
  opts: { locale: string; timeZone: string; dateStyle?: Intl.DateTimeFormatOptions["dateStyle"] },
): string {
  return formatDateTimeInZone(date, opts);
}

/**
 * Bir rezervasyonun saatlerinin okunacağı saat dilimi.
 *
 * Dükkanın kendi dilimi; tanımsızsa platform dilimi. Fallback sessiz DEĞİL:
 * `Shop.timezone` null olan bir dükkan, kendi ülkesindeki misafire yanlış saat
 * gösterir -- ama bunun yeri bu fonksiyon değil, dükkan kaydıdır.
 */
export function bookingTimeZone(shop: { timezone?: string | null } | null | undefined): string {
  return shop?.timezone ?? PLATFORM_TIMEZONE;
}
