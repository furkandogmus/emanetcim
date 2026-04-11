export type PaymentGateway = "iyzico" | "stripe";

/**
 * Aktif ödeme sağlayıcısı. Varsayılan iyzico (mevcut üretim akışı).
 * Stripe için `PAYMENT_GATEWAY=stripe` ve Stripe env değişkenleri gerekir.
 */
export function getPaymentGateway(): PaymentGateway {
  const g = process.env.PAYMENT_GATEWAY?.trim().toLowerCase();
  if (g === "stripe") return "stripe";
  return "iyzico";
}

export function isStripePaymentIntentId(transactionId: string): boolean {
  return transactionId.startsWith("pi_");
}
