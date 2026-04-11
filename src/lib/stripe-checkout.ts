import { getPaymentGateway } from "@/lib/payment-gateway";

/** Misafir rezervasyon ödemesi (Payment Element) için Stripe + publishable key hazır mı? */
export function isStripeGuestCheckoutEnabled(): boolean {
  return (
    getPaymentGateway() === "stripe" &&
    !!process.env.STRIPE_SECRET_KEY?.trim() &&
    !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  );
}
