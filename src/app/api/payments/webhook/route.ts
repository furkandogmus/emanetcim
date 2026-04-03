import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/PaymentService";
import { verifyIyzicoWebhookSignatureV3 } from "@/lib/iyzico-webhook";

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

    console.log("[Webhook Received]", body);

    const conversationId =
      (typeof body.paymentConversationId === "string" && body.paymentConversationId) ||
      (typeof body.conversationId === "string" && body.conversationId) ||
      "";

    const paymentId = String(
      body.paymentId ?? body.iyziPaymentId ?? ""
    );

    // 1. iyzico'dan gelen standart alanları oku
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

    // 2. Servis katmanında işle
    const result = await paymentService.processWebhook(payload);

    if (result.success) {
      // iyzico sistemine 'aldık, teşekkürler' dememiz gerekiyor (200 OK)
      return NextResponse.json({ status: "OK", message: result.message }, { status: 200 });
    } else {
      return NextResponse.json({ status: "Ignored", message: result.message }, { status: 200 });
    }

  } catch (error: any) {
    console.error("[Webhook Critical Error]", error);
    // Hata durumunda 500 dönüyoruz ki iyzico tekrar denesin (Resend Policy)
    return NextResponse.json({ status: "Error", message: error.message }, { status: 500 });
  }
}
