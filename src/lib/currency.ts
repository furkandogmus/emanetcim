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
