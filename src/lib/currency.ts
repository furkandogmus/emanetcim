/**
 * TRY tutarları — gösterim ve Stripe (kuruş) birimleri.
 * Platform fiyatları şu an TRY; başka para birimi eklenirse burada genişletilir.
 */

export const PLATFORM_DISPLAY_CURRENCY = "TRY" as const;

/** Stripe: TRY için alt birim kuruş (2 ondalık). */
export function tryAmountToStripeMinorUnits(amountTry: number): number {
  if (!Number.isFinite(amountTry) || amountTry < 0) {
    throw new Error("Invalid TRY amount for Stripe");
  }
  return Math.round(amountTry * 100);
}

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
