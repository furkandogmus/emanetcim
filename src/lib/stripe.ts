import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function assertStripeKeys(): void {
  if (process.env.NODE_ENV !== "production") return;
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  if (!k) {
    throw new Error(
      "STRIPE_SECRET_KEY is required in production when PAYMENT_GATEWAY=stripe"
    );
  }
}

/**
 * Sunucu tarafı Stripe istemcisi. Yalnızca ödeme gateway’i Stripe iken çağrılmalıdır.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export function getStripeWebhookSigningSecret(): string {
  const s =
    process.env.STRIPE_WEBHOOK_SIGNING_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!s) {
    throw new Error(
      "STRIPE_WEBHOOK_SIGNING_SECRET (or STRIPE_WEBHOOK_SECRET) is not set"
    );
  }
  return s;
}
