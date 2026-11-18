import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { findUnique, applyBagRevision, clearBagRevision } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  applyBagRevision: vi.fn(),
  clearBagRevision: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: { booking: { findUnique } } }));
vi.mock("@/lib/mobile-auth", () => ({ requireMobileUser: vi.fn(async () => ({ user: { id: "g1" } })) }));
vi.mock("@/services/BookingService", () => ({ bookingService: { applyBagRevision, clearBagRevision } }));

import { POST } from "@/app/api/mobile/bookings/[id]/bag-revision/route";

const call = (body: unknown) =>
  POST(new NextRequest("http://x/api/mobile/bookings/b1/bag-revision", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "b1" }),
  });

describe("misafir valiz duzeltmesi onayi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ guestId: "g1", pendingBagRevision: { newTotal: 144 } });
    applyBagRevision.mockResolvedValue({ ok: true, newTotal: 144, delta: 72 });
  });

  it("gorulen tutar ayniysa uygular", async () => {
    const res = await call({ action: "approve", expectedNewTotal: 144 });
    expect(res!.status).toBe(200);
    expect(applyBagRevision).toHaveBeenCalled();
  });

  it("esnaf arada oneriyi degistirdiyse uygulamaz (409 revision_changed)", async () => {
    const res = await call({ action: "approve", expectedNewTotal: 99 });
    expect(res!.status).toBe(409);
    expect(await res!.json()).toEqual({ error: "revision_changed" });
    expect(applyBagRevision).not.toHaveBeenCalled();
  });

  it("baska misafirin rezervasyonuna dokunamaz", async () => {
    findUnique.mockResolvedValue({ guestId: "other", pendingBagRevision: { newTotal: 144 } });
    const res = await call({ action: "approve", expectedNewTotal: 144 });
    expect(res!.status).toBe(403);
  });
});
