import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

/**
 * `/api/webhooks/resend` yalnizca Svix imzasi kabul eder (2026-11-24): eski
 * zaman damgasiz HMAC yolu kaldirildi, ayni `svix-id` ikinci kez islenmez.
 */

const m = vi.hoisted(() => ({ updateMany: vi.fn() }));

vi.mock("@/lib/db", () => ({ default: { notificationLog: { updateMany: m.updateMany } } }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));
vi.mock("@/lib/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-limit")>()),
  rateLimit: vi.fn().mockResolvedValue(true),
}));

import { POST } from "@/app/api/webhooks/resend/route";
import { claimOnce } from "@/lib/rate-limit";

const SECRET = "whsec_" + Buffer.from("test-signing-key").toString("base64");
const BODY = JSON.stringify({ type: "email.delivered", data: { email_id: "e1", to: ["a@example.com"] } });

function svixRequest(id: string, body = BODY, secret = SECRET) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` },
    body,
  });
}

const prevSecret = process.env.RESEND_WEBHOOK_SECRET;
beforeEach(() => {
  vi.clearAllMocks();
  m.updateMany.mockResolvedValue({ count: 1 });
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  process.env.RESEND_WEBHOOK_SECRET = prevSecret;
});

describe("resend webhook", () => {
  it("whsec_ olmayan sir yanlis yapilandirma: 503", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "plain-shared-secret";
    const res = await POST(svixRequest("msg_cfg"));
    expect(res.status).toBe(503);
  });

  it("eski HMAC basligi (x-resend-signature) 401", async () => {
    const sig = createHmac("sha256", SECRET).update(BODY).digest("hex");
    const res = await POST(
      new Request("http://localhost/api/webhooks/resend", {
        method: "POST",
        headers: { "x-resend-signature": `sha256=${sig}` },
        body: BODY,
      }),
    );
    expect(res.status).toBe(401);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("gecerli Svix istegi islenir, ayni id ikinci kez islenmez", async () => {
    const first = await POST(svixRequest("msg_dup"));
    expect(first.status).toBe(200);
    const again = await POST(svixRequest("msg_dup"));
    expect((await again.json()).message).toBe("Duplicate delivery ignored");
    expect(m.updateMany).toHaveBeenCalledOnce();
  });
});

describe("claimOnce", () => {
  it("anahtari sure boyunca bir kez verir", async () => {
    expect(await claimOnce("t:once", 60_000)).toBe(true);
    expect(await claimOnce("t:once", 60_000)).toBe(false);
    expect(await claimOnce("t:other", 60_000)).toBe(true);
  });
});
