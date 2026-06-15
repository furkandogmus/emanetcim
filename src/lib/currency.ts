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
