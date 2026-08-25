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

/**
 * Bir saat diliminin belirli bir AN'daki UTC ofsetini milisaniye olarak verir.
 *
 * `Intl` bize doğrudan ofset vermiyor; o an için bölgenin duvar saatini üretip
 * UTC ile farkını alıyoruz. DST geçişleri dahil doğru sonuç verir.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * `datetime-local` DUVAR SAATİNİ belirli bir saat diliminde yorumlar.
 *
 * NEDEN GEREKLİ (2026-08-22'de ölçüldü): `parseDatetimeLocal` değeri `new Date()`
 * ile ayrıştırıyor, yani **cihazın** saat diliminde yorumluyor. Ama ana sayfa
 * varsayılanları `toDatetimeLocalValueInTimeZone` ile **İstanbul** saatinde
 * üretiliyor ve dükkan açık/kapalı hesabı da İstanbul referanslı. İkisi ayrışıyordu:
 *
 *   Ana sayfada gösterilen (İstanbul): 2026-08-22T14:00
 *   Cihaz Berlin ise sunucuya giden  : 12:00Z  (yani İstanbul 15:00)
 *   Olması gereken                   : 11:00Z  (İstanbul 14:00)
 *
 * Berlin'de 1 saat, New York'ta 7 saat kayma. Hedef kitle turist olduğu için asıl
 * senaryo şu: Alman bir misafir **seyahatten önce evinden** rezervasyon yapıyor,
 * "14:00" seçiyor, dükkana 15:00 bildiriliyor ve misafir 14:00'te geliyor.
 *
 * Bu ürün için doğru model: rezervasyon saatleri DÜKKANIN yerel saatidir, misafirin
 * cihazınınki değil. Misafir Berlin'de otururken bile İstanbul'daki bir dükkana
 * "saat 14:00'te bırakacağım" der.
 */
export function parseDatetimeLocalInTimeZone(
  value: string,
  timeZone: string = PLATFORM_TIMEZONE,
): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Duvar saatini önce UTC'ymiş gibi al, sonra bölgenin ofseti kadar geri sar.
  const asIfUtc = new Date(`${trimmed}${trimmed.length === 16 ? ":00" : ""}Z`);
  if (Number.isNaN(asIfUtc.getTime())) return null;

  const firstGuess = new Date(asIfUtc.getTime() - zoneOffsetMs(asIfUtc, timeZone));
  /**
   * DST sınırında bir düzeltme daha: ofset, tahmin edilen ANDA farklı olabilir.
   * (Örn. saat ileri alınan gece 03:00 seçildiğinde.)
   */
  const refinedOffset = zoneOffsetMs(firstGuess, timeZone);
  const refined = new Date(asIfUtc.getTime() - refinedOffset);
  return Number.isNaN(refined.getTime()) ? null : refined;
}

/**
 * IANA saat dilimi kimliğinden okunur şehir adı üretir: `Europe/Istanbul` → `Istanbul`.
 *
 * NEDEN (2026-08-24): "Saatler dükkanın yerel saatiyle (İstanbul)." metni 6 dilde de
 * İstanbul'u SABİT yazıyordu. Şema `Shop.timezone` tutuyor ve `SlotService` müsaitliği
 * o dilimde hesaplıyor; İstanbul dışı ilk dükkan eklendiğinde metin yalan söyler —
 * üstelik tam da hangi takvimin geçerli olduğunu açıklaması gereken cümlede.
 * Metin artık `{zone}` parametresi alıyor, kaynağı dükkanın kendi dilimi.
 */
export function timeZoneCityLabel(
  timeZone: string = PLATFORM_TIMEZONE,
): string {
  const last = timeZone.split("/").pop() ?? timeZone;
  return last.replace(/_/g, " ");
}
