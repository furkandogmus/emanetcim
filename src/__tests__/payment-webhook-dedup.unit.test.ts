import { describe, expect, it } from "vitest";
import { iyzicoWebhookDedupKey } from "@/lib/iyzico-webhook-dedup-key";

describe("iyzicoWebhookDedupKey", () => {
  it("is stable for same payload fields", () => {
    const body = {
      paymentId: "p1",
      paymentConversationId: "conv",
      status: "SUCCESS",
      iyziEventType: "PAYMENT_SUCCESS",
    };
    expect(iyzicoWebhookDedupKey(body)).toBe(iyzicoWebhookDedupKey(body));
  });

  it("changes when paymentId changes", () => {
    const a = iyzicoWebhookDedupKey({
      paymentId: "1",
      paymentConversationId: "c",
      status: "SUCCESS",
      iyziEventType: "T",
    });
    const b = iyzicoWebhookDedupKey({
      paymentId: "2",
      paymentConversationId: "c",
      status: "SUCCESS",
      iyziEventType: "T",
    });
    expect(a).not.toBe(b);
  });
});

describe("iyzico webhook route idempotency contract", () => {
  it("dedup key is hex sha256 length", () => {
    const k = iyzicoWebhookDedupKey({
      paymentId: "x",
      paymentConversationId: "y",
      status: "z",
      iyziEventType: "e",
    });
    expect(k).toMatch(/^[a-f0-9]{64}$/);
  });
});
