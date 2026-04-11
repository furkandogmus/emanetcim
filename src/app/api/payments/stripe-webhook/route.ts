import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { paymentService } from "@/services/PaymentService";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import { getPaymentGateway } from "@/lib/payment-gateway";
import { getStripeWebhookSigningSecret, getStripe } from "@/lib/stripe";
import {
  claimPaymentWebhookEvent,
  isPaymentWebhookProcessed,
} from "@/lib/payment-webhook-dedup";
import { recordMetric } from "@/lib/metrics";

export const runtime = "nodejs";

/**
 * Stripe webhook — `payment_intent.succeeded` ile PENDING rezervasyonu PAID yapar.
 * Dashboard: aynı uç noktayı Stripe CLI / panelden kaydedin.
 */
export async function POST(req: NextRequest) {
  try {
    recordMetric("webhook_received_total", { channel: "stripe" });
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!(await rateLimit(`stripe_webhook:${ip}`, 120, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (!isPaymentsEnabled()) {
      return NextResponse.json({ error: "Payments disabled" }, { status: 503 });
    }

    if (getPaymentGateway() !== "stripe") {
      return NextResponse.json(
        { error: "Stripe webhook ignored (PAYMENT_GATEWAY is not stripe)" },
        { status: 400 }
      );
    }

    const raw = Buffer.from(await req.arrayBuffer());
    const sig = req.headers.get("stripe-signature");
    if (!sig?.trim()) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        raw,
        sig,
        getStripeWebhookSigningSecret()
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordMetric("webhook_signature_failures", { channel: "stripe" });
      logger.warn({ err: msg }, "stripe_webhook_signature_invalid");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const stripeDedupKey = `stripe:event:${event.id}`;
      if (await isPaymentWebhookProcessed(stripeDedupKey)) {
        return NextResponse.json({
          received: true,
          duplicate: true,
          message: "Duplicate Stripe event ignored",
        });
      }
      logger.info(
        {
          event: "stripe_webhook_payment_intent_succeeded",
          paymentIntentId: pi.id,
          bookingId: pi.metadata?.bookingId,
        },
        "stripe_webhook"
      );
      const result = await paymentService.confirmStripePaymentIntentSucceeded({
        id: pi.id,
        status: pi.status,
        metadata: pi.metadata ?? undefined,
      });
      if (result.success) {
        await claimPaymentWebhookEvent({
          provider: "stripe",
          dedupKey: stripeDedupKey,
          paymentId: pi.id,
          conversationId: pi.metadata?.bookingId ?? null,
        });
        return NextResponse.json({ received: true, message: result.message });
      }
      return NextResponse.json({ received: true, ignored: result.message });
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      logger.info(
        {
          event: "stripe_webhook_payment_intent_failed",
          paymentIntentId: pi.id,
          bookingId: pi.metadata?.bookingId,
        },
        "stripe_webhook"
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, "stripe_webhook_critical");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
