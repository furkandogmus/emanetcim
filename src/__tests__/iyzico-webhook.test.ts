import { describe, it, expect } from "vitest";
import {
  computeIyzicoWebhookSignatureV3Hex,
  verifyIyzicoWebhookSignatureV3,
} from "@/lib/iyzico-webhook";

describe("iyzico X-IYZ-SIGNATURE-V3 (Direct Format)", () => {
  it("matches iyzico Direct sample: HMAC-SHA256(secretKey, secretKey+event+paymentId+conv+status)", () => {
    const secretKey = "skey";
    const body = {
      iyziEventType: "PAYMENT_API",
      paymentId: "p1",
      paymentConversationId: "booking-uuid",
      status: "SUCCESS",
    };
    const expected = computeIyzicoWebhookSignatureV3Hex(body, secretKey);
    const prev = process.env.IYZICO_SECRET_KEY;
    process.env.IYZICO_SECRET_KEY = secretKey;
    try {
      expect(verifyIyzicoWebhookSignatureV3(body, expected)).toBe(true);
      expect(verifyIyzicoWebhookSignatureV3(body, "deadbeef")).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.IYZICO_SECRET_KEY;
      else process.env.IYZICO_SECRET_KEY = prev;
    }
  });

  it("HPP: uses token branch when token is non-empty", () => {
    const secretKey = "sec";
    const body = {
      iyziEventType: "CHECKOUT_FORM_AUTH",
      iyziPaymentId: "99",
      token: "tok",
      paymentConversationId: "c1",
      status: "SUCCESS",
    };
    const hex = computeIyzicoWebhookSignatureV3Hex(body, secretKey);
    const prev = process.env.IYZICO_SECRET_KEY;
    process.env.IYZICO_SECRET_KEY = secretKey;
    try {
      expect(verifyIyzicoWebhookSignatureV3(body, hex)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.IYZICO_SECRET_KEY;
      else process.env.IYZICO_SECRET_KEY = prev;
    }
  });
});
