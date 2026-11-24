import { describe, it, expect, vi } from "vitest";

/** APNs: ayni anda en fazla APNS_CONCURRENCY akis. */
const { state } = vi.hoisted(() => ({ state: { open: 0, peak: 0 } }));
vi.mock("node:http2", () => {
  const request = () => {
    state.open += 1;
    state.peak = Math.max(state.peak, state.open);
    const handlers: Record<string, (h: Record<string, number>) => void> = {};
    return {
      setTimeout: () => undefined,
      on: (ev: string, cb: (h: Record<string, number>) => void) => { handlers[ev] = cb; },
      resume: () => undefined,
      close: () => undefined,
      end: () => setTimeout(() => { state.open -= 1; handlers.response?.({ ":status": 200 }); }, 5),
    };
  };
  const connect = () => ({ on: () => undefined, request, close: () => undefined });
  return { default: { connect, constants: { NGHTTP2_CANCEL: 8 } }, connect };
});

import { APNS_CONCURRENCY, sendPassUpdatePushes } from "@/lib/wallet/apns";

describe("sendPassUpdatePushes", () => {
  it("23 token, en fazla 5 eszamanli akis, hepsi sonuclanir", async () => {
    const tokens = Array.from({ length: 23 }, (_, i) => `t${i}`);
    const res = await sendPassUpdatePushes(
      { passTypeId: "pass.example.test", teamId: "T", signerCert: "c", signerKey: "k", wwdr: "w" },
      tokens,
    );
    expect(res).toHaveLength(23);
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect(state.peak).toBeLessThanOrEqual(APNS_CONCURRENCY);
  });
});
