import crypto from "crypto";

export function iyzicoWebhookDedupKey(body: Record<string, unknown>): string {
  const paymentId = String(body.paymentId ?? body.iyziPaymentId ?? "");
  const conv = String(
    body.paymentConversationId ?? body.conversationId ?? "",
  );
  const status = String(body.status ?? "");
  const et = String(body.iyziEventType ?? "");
  const raw = `iyzico|${paymentId}|${conv}|${status}|${et}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}
