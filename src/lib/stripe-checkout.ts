import type { StripeElementLocale } from "@stripe/stripe-js";
import { getPaymentGateway } from "@/lib/payment-gateway";

/**
 * next-intl locale → Stripe Elements locale (Stripe desteklemeyen dillerde `en`).
 */
export function stripeElementsLocaleFromAppLocale(
  appLocale: string
): StripeElementLocale {
  const key = appLocale.split("-")[0]?.toLowerCase() ?? "en";
  const map: Record<string, StripeElementLocale> = {
    en: "en",
    tr: "tr",
    de: "de",
    fr: "fr",
    es: "es",
    it: "it",
    pl: "pl",
    ja: "ja",
    ko: "ko",
    ar: "ar",
    bg: "bg",
    ru: "ru",
    zh: "zh",
    fa: "en",
  };
  return map[key] ?? "en";
}

/** Misafir rezervasyon ödemesi (Payment Element) için Stripe + publishable key hazır mı? */
export function isStripeGuestCheckoutEnabled(): boolean {
  return (
    getPaymentGateway() === "stripe" &&
    !!process.env.STRIPE_SECRET_KEY?.trim() &&
    !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  );
}
