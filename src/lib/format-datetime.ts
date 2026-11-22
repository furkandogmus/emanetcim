import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

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

/** `formatInstant` seçenekleri: `timeZone` bilerek DIŞARIDA, ayrı parametre. */
export type InstantFormatOptions = Omit<Intl.DateTimeFormatOptions, "timeZone">;

const DEFAULT_INSTANT_OPTIONS: InstantFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

/**
 * Bir ANI (rezervasyon saati, kayıt zamanı, iş çalışması) her zaman sabit bir
 * saat diliminde ve etkin dilde biçimlendirir. Varsayılan dilim platformun
 * dilimi (`PLATFORM_TIMEZONE`, İstanbul).
 *
 * NEDEN (2026-11-22, web kalite taraması): admin ve esnaf panellerinde ~20
 * yerde `new Date(iso).toLocaleString(dateLocale, {...})` vardı, `timeZone`
 * yoktu. İki ayrı hata üretiyordu:
 *
 *   1. SSR uyuşmazlığı: sunucu (konteyner UTC) "10:00", tarayıcı (İstanbul)
 *      "13:00" basıyordu; React hydration'da metin uyuşmazlığı verip ağacı
 *      istemcide yeniden çiziyordu.
 *   2. Yanlış saat: yurt dışından bakan bir yönetici ya da esnaf (Berlin'de
 *      tatildeki dükkan sahibi) rezervasyon saatini KENDİ cihazının saatinde
 *      görüyordu, dükkanınkinde değil.
 *
 * `locale` uygulama dili (`tr`) ya da BCP 47 etiketi (`tr-TR`) olabilir;
 * ikisi de `bcp47ForUiLocale`dan geçer. Geçersiz/boş girdi boş dize döner —
 * `Intl` geçersiz tarihte `RangeError` fırlatıp sayfayı düşürür.
 *
 * Mandal: `no-timezone-date-format.test.ts` — `src` altında `timeZone`suz
 * tarih biçimlendirmesi kalmadı.
 */
export function formatInstant(
  date: Date | string | number | null | undefined,
  locale: string,
  options: InstantFormatOptions = DEFAULT_INSTANT_OPTIONS,
  timeZone: string = PLATFORM_TIMEZONE,
): string {
  if (date == null || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(bcp47ForUiLocale(locale), {
    ...options,
    timeZone,
  }).format(d);
}
