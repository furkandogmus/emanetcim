/** Platform fiyatları şu an TRY; başka para birimi eklenirse burada genişletilir. */

export const PLATFORM_DISPLAY_CURRENCY = "TRY" as const;

export function formatTryCurrency(
  amountTry: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: PLATFORM_DISPLAY_CURRENCY,
    ...options,
  }).format(amountTry);
}

/**
 * Yabancı dilde TRY fiyatın yanında gösterilen yaklaşık karşılık için sabit kur
 * (1 birim = X TRY). Ödeme her zaman TRY çekilir; bu yalnızca turistin "bu kaç
 * euro/dolar" sorusunu cevaplar. 2026-09-30 kuru: 250 TL ≈ €4,50 ≈ $5.
 * Kur ciddi kayarsa buradan güncellenir.
 */
export const DISPLAY_FX_TRY_PER_UNIT = { EUR: 55.6, USD: 49 } as const;

type ForeignCurrency = keyof typeof DISPLAY_FX_TRY_PER_UNIT;

const FOREIGN_CURRENCY_BY_LOCALE: Record<string, ForeignCurrency> = {
  de: "EUR",
  fr: "EUR",
  en: "USD",
  ja: "USD",
  fa: "USD",
};

export function foreignDisplayCurrency(locale: string): ForeignCurrency | null {
  return FOREIGN_CURRENCY_BY_LOCALE[locale.split("-")[0]] ?? null;
}

/** "≈ 4,50 €" / "≈ $5"; Türkçe'de ya da tutar 0'a yuvarlanıyorsa `null`. */
export function formatApproxForeign(amountTry: number, locale: string): string | null {
  const currency = foreignDisplayCurrency(locale);
  if (!currency || !Number.isFinite(amountTry)) return null;
  const converted = Math.round((amountTry / DISPLAY_FX_TRY_PER_UNIT[currency]) * 2) / 2;
  if (converted <= 0) return null;
  const digits = Number.isInteger(converted) ? 0 : 2;
  const text = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(converted);
  return `≈ ${text}`;
}

/**
 * Ondalıklı sayı gösterimi (para DEĞİL) — puan, süre vb.
 *
 * NEDEN GEREKLİ: ham JS sayısı basmak her zaman NOKTA kullanır (`4.5`, `1.5`).
 * Türkçe ve çoğu Avrupa dilinde ondalık ayracı **virgüldür** ve nokta **binlik
 * ayracı** anlamına gelir — yani `1.5` bazı kullanıcılar için "bin beş yüz" gibi
 * okunur. 2026-08-22'de dükkan puanı (`rating.toFixed(1)`) ve slot süresi
 * (`count * 0.5`) bu şekilde basılıyordu.
 */
export function formatDecimal(
  value: number,
  locale: string,
  fractionDigits = 1,
): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);
}
