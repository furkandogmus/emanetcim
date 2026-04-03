import crypto from "crypto";

/**
 * iyzico Direct Format (NON-3DS / 3DS) — X-IYZ-SIGNATURE-V3
 * @see https://docs.iyzico.com/en/advanced/webhook — "Validation of Direct Format"
 *
 * message = secretKey + iyziEventType + paymentId + paymentConversationId + status
 * HMAC-SHA256(key = secretKey, data = message) → hex
 */

/**
 * HPP (Checkout Form / PWI vb.) — token içeren bildirimler
 * message = secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status
 */
function buildV3MessageDirect(
  secretKey: string,
  body: Record<string, unknown>
): string {
  const iyziEventType = String(body.iyziEventType ?? "");
  const paymentId = String(body.paymentId ?? body.iyziPaymentId ?? "");
  const paymentConversationId = String(body.paymentConversationId ?? "");
  const status = String(body.status ?? "");
  return secretKey + iyziEventType + paymentId + paymentConversationId + status;
}

function buildV3MessageHpp(
  secretKey: string,
  body: Record<string, unknown>
): string {
  const iyziEventType = String(body.iyziEventType ?? "");
  const iyziPaymentId = String(body.iyziPaymentId ?? "");
  const token = String(body.token ?? "");
  const paymentConversationId = String(body.paymentConversationId ?? "");
  const status = String(body.status ?? "");
  return secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status;
}

function computeV3Hex(secretKey: string, body: Record<string, unknown>): string {
  const hasToken =
    body.token != null && String(body.token).length > 0;
  const message = hasToken
    ? buildV3MessageHpp(secretKey, body)
    : buildV3MessageDirect(secretKey, body);
  return crypto.createHmac("sha256", secretKey).update(message).digest("hex");
}

/**
 * X-IYZ-SIGNATURE-V3 doğrulaması.
 * Header yoksa: true (iyzico panelde imza kapalı olabilir).
 * Header varsa: IYZICO_SECRET_KEY (veya IYZICO_WEBHOOK_SECRET) ile doğrulanır.
 */
export function verifyIyzicoWebhookSignatureV3(
  body: Record<string, unknown>,
  signatureHeader: string | null | undefined
): boolean {
  const secretKey =
    process.env.IYZICO_SECRET_KEY || process.env.IYZICO_WEBHOOK_SECRET;
  const sig = signatureHeader?.trim();

  if (!sig) {
    return true;
  }

  if (!secretKey) {
    console.warn(
      "[iyzico webhook] X-IYZ-SIGNATURE-V3 present but IYZICO_SECRET_KEY is not set"
    );
    return false;
  }

  const expected = computeV3Hex(secretKey, body);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

/** Test ve hata ayıklama için dışa açık (prod akışında verify kullanın) */
export function computeIyzicoWebhookSignatureV3Hex(
  body: Record<string, unknown>,
  secretKey: string
): string {
  return computeV3Hex(secretKey, body);
}
