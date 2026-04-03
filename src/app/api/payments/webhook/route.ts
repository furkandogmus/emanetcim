import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/PaymentService";
import { verifyIyzicoWebhookSignatureV3 } from "@/lib/iyzico-webhook";
import logger from "@/lib/logger";

/**
 * iyzico Payment Webhook Handler
 * URL: /api/payments/webhook
 * Direct Format: paymentConversationId = merchant reference (bookingId).
 */
export async function POST(req: NextRequest) {
  try {
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

    const result = await paymentService.processWebhook(payload);

    if (result.success) {
      return NextResponse.json({ status: "OK", message: result.message }, { status: 200 });
    } else {
      return NextResponse.json({ status: "Ignored", message: result.message }, { status: 200 });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, "iyzico_webhook_critical");
    return NextResponse.json({ status: "Error", message }, { status: 500 });
  }
}
