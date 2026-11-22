import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Mobil kapanis uclari: sozlesme (`{ success: true }` / `{ error: kod }` +
 * HTTP durumu) ve govdenin servise aynen gecmesi. Kural testleri
 * `booking-closure.test.ts`te.
 */

const m = vi.hoisted(() => ({
  user: { id: "u1", role: "ADMIN" as string },
  svc: {
    adminCancelBooking: vi.fn(),
    adminForceCheckOut: vi.fn(),
    partnerCancelBooking: vi.fn(),
    markNoShow: vi.fn(),
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(async () => ({ user: m.user })),
  requireRole: (user: { role: string }, roles: string[]) =>
    roles.includes(user.role) ? null : NextResponse.json({ error: "forbidden" }, { status: 403 }),
}));
vi.mock("@/services/booking/closure", () => m.svc);

import { POST as adminCancel } from "@/app/api/mobile/admin/bookings/[id]/cancel/route";
import { POST as forceCheckout } from "@/app/api/mobile/admin/bookings/[id]/force-checkout/route";
import { POST as partnerCancel } from "@/app/api/mobile/partner/bookings/[id]/cancel/route";
import { POST as noShow } from "@/app/api/mobile/partner/bookings/[id]/no-show/route";

const params = { params: Promise.resolve({ id: "b1" }) };

/** Uclarin donus tipi `auth.error` yuzunden `undefined` icerir; burada her zaman yanit vardir. */
async function run(p: Promise<Response | undefined>): Promise<Response> {
  const r = await p;
  if (!r) throw new Error("uc yanit donmedi");
  return r;
}
const req = (body?: unknown) =>
  new NextRequest("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.user = { id: "u1", role: "ADMIN" };
});

describe("yonetici uclari", () => {
  it("iptal: note servise gecer, basarida { success: true }", async () => {
    m.svc.adminCancelBooking.mockResolvedValue({ ok: true });
    const res = await run(adminCancel(req({ note: "misafir aradi" }), params));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(m.svc.adminCancelBooking).toHaveBeenCalledWith("b1", m.user, expect.objectContaining({ note: "misafir aradi" }));
  });

  it("admin olmayan 403 forbidden, servise gitmez", async () => {
    m.user = { id: "u2", role: "PARTNER" };
    for (const handler of [adminCancel, forceCheckout]) {
      const res = await run(handler(req({ note: "misafir aradi" }), params));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "forbidden" });
    }
    expect(m.svc.adminCancelBooking).not.toHaveBeenCalled();
    expect(m.svc.adminForceCheckOut).not.toHaveBeenCalled();
  });

  it.each([
    ["NOT_FOUND", 404, "not_found"],
    ["INVALID_STATUS", 400, "invalid_status"],
    ["NOTE_REQUIRED", 400, "note_required"],
  ])("zorla teslim %s -> %i %s", async (code, status, error) => {
    m.svc.adminForceCheckOut.mockResolvedValue({ ok: false, code });
    const res = await run(forceCheckout(req({ note: "x" }), params));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("bozuk govde bos sayilir (servis note_required der)", async () => {
    m.svc.adminCancelBooking.mockResolvedValue({ ok: false, code: "NOTE_REQUIRED" });
    const res = await run(adminCancel(req("{bozuk"), params));
    expect(res.status).toBe(400);
    expect(m.svc.adminCancelBooking).toHaveBeenCalledWith("b1", m.user, expect.objectContaining({ note: undefined }));
  });
});

describe("esnaf uclari", () => {
  beforeEach(() => {
    m.user = { id: "owner-1", role: "PARTNER" };
  });

  it("iptal: reason + note servise gecer", async () => {
    m.svc.partnerCancelBooking.mockResolvedValue({ ok: true });
    const res = await run(partnerCancel(req({ reason: "other", note: "su kesildi" }), params));
    expect(await res.json()).toEqual({ success: true });
    expect(m.svc.partnerCancelBooking).toHaveBeenCalledWith("b1", m.user, { reason: "other", note: "su kesildi" });
  });

  it.each([
    ["INVALID_REASON", 400, "invalid_reason"],
    ["FORBIDDEN", 403, "forbidden"],
    ["NOTE_REQUIRED", 400, "note_required"],
  ])("iptal %s -> %i %s", async (code, status, error) => {
    m.svc.partnerCancelBooking.mockResolvedValue({ ok: false, code });
    const res = await run(partnerCancel(req({ reason: "x" }), params));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("gelmedi: too_early 400, basari 200", async () => {
    m.svc.markNoShow.mockResolvedValueOnce({ ok: false, code: "TOO_EARLY" }).mockResolvedValueOnce({ ok: true });
    const early = await run(noShow(req({}), params));
    expect(early.status).toBe(400);
    expect(await early.json()).toEqual({ error: "too_early" });
    const ok = await run(noShow(req({}), params));
    expect(await ok.json()).toEqual({ success: true });
    expect(m.svc.markNoShow).toHaveBeenCalledWith("b1", m.user);
  });
});
