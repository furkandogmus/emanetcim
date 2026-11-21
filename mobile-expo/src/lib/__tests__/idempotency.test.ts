import { describe, expect, it } from "@jest/globals";

import { newIdempotencyKey } from "../idempotency";

/** Sunucu bicimi (`checkout/intent`): [A-Za-z0-9_-]{8,80}. */
describe("newIdempotencyKey", () => {
  it("sunucunun kabul ettigi bicimde", () => {
    expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
  });

  it("her cagri farkli", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });

  it("crypto.randomUUID yokken de gecerli", () => {
    const g = globalThis as { crypto?: unknown };
    const saved = g.crypto;
    g.crypto = undefined;
    try {
      expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    } finally {
      g.crypto = saved;
    }
  });
});
