import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/PaymentService";
import { verifyIyzicoWebhookSignatureV3 } from "@/lib/iyzico-webhook";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import {
  claimPaymentWebhookEvent,
  iyzicoWebhookDedupKey,
  isPaymentWebhookProcessed,
} from "@/lib/payment-webhook-dedup";
import { recordMetric } from "@/lib/metrics";
import { getClientIp } from "@/lib/get-ip";

/**
 * iyzico Payment Webhook Handler
 * URL: /api/payments/webhook
 * Direct Format: paymentConversationId = merchant reference (bookingId).
 */
export async function POST(req: NextRequest) {
  try {
    recordMetric("webhook_received_total", { channel: "iyzico" });
    const ip = await getClientIp(req);
    if (!(await rateLimit(`webhook:${ip}`, 120, 60_000))) {
      return NextResponse.json(
        { status: "Error", message: "Too many requests" },
        { status: 429 }
      );
    }

    if (!(await isPaymentsEnabled())) {
      return NextResponse.json(
        { status: "Error", message: "Payments disabled" },
        { status: 503 }
      );
    }

    const raw = await req.text();
    const body = JSON.parse(raw) as Record<string, unknown>;

    const sigV3 =
      req.headers.get("x-iyz-signature-v3") ||
      req.headers.get("X-IYZ-SIGNATURE-V3");

    if (process.env.IYZICO_WEBHOOK_REQUIRE_SIGNATURE === "true" && !sigV3?.trim()) {
      return NextResponse.json(
        { status: "Error", message: "Missing X-IYZ-SIGNATURE-V3" },
        { status: 401 }
      );
    }

    if (!verifyIyzicoWebhookSignatureV3(body, sigV3)) {
      recordMetric("webhook_signature_failures", { channel: "iyzico" });
      return NextResponse.json(
        { status: "Error", message: "Invalid signature" },
        { status: 401 }
      );
    }

    const conversationId =
      (typeof body.paymentConversationId === "string" && body.paymentConversationId) ||
      (typeof body.conversationId === "string" && body.conversationId) ||
      "";

    const paymentId = String(
      body.paymentId ?? body.iyziPaymentId ?? ""
    );

    logger.info(
      {
        event: "iyzico_webhook_received",
        conversationId,
        paymentId,
        status: String(body.status ?? ""),
        iyziEventType: typeof body.iyziEventType === "string" ? body.iyziEventType : undefined,
      },
      "iyzico_webhook"
    );

    const payload = {
      status: String(body.status ?? ""),
      paymentId,
      conversationId,
      hash: typeof body.iyziReferenceCode === "string" ? body.iyziReferenceCode : undefined,
    };

    if (!payload.conversationId) {
      return NextResponse.json(
        { status: "Error", message: "Missing paymentConversationId or conversationId" },
        { status: 400 }
      );
    }

    const dedupKey = iyzicoWebhookDedupKey(body);
    if (await isPaymentWebhookProcessed(dedupKey)) {
      return NextResponse.json(
        { status: "OK", message: "Duplicate event ignored", duplicate: true },
        { status: 200 },
      );
    }

    const result = await paymentService.processWebhook(payload);

    if (result.success) {
      await claimPaymentWebhookEvent({
        provider: "iyzico",
        dedupKey,
        paymentId: payload.paymentId || null,
        conversationId: payload.conversationId,
      });
      return NextResponse.json({ status: "OK", message: result.message }, { status: 200 });
    } else {
      return NextResponse.json({ status: "Ignored", message: result.message }, { status: 200 });
    }

  } catch (error: unknown) {
    logger.error({ err: error }, "iyzico_webhook_critical");
    return NextResponse.json({ status: "Error", message: "Internal error" }, { status: 500 });
  }
}
