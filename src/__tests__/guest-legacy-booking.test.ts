import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Hesapsiz yaratma 2026-11-23'te kapandi; ONCE yaratilmis hesapsiz rezervasyon
 * (guestId NULL, guestEmail dolu) e-postadaki yonetim bagiyla hala iptal edilir.
 */
const m = vi.hoisted(() => ({ findUnique: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { booking: { findUnique: m.findUnique } } }));
vi.mock("@/services/BookingService", () => ({ bookingService: { cancelBooking: m.cancel } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.stubEnv("AUTH_SECRET", "test-secret-legacy-guest");

const { POST } = await import("@/app/api/bookings/guest-cancel/route");
const { signGuestManageLinkToken } = await import("@/lib/guest-lookup-token");

async function cancelWith(email: string) {
  const token = await signGuestManageLinkToken({
    bookingId: "b-legacy",
    email,
    checkOutTime: new Date(Date.now() + 24 * 3600_000),
  });
  return POST(
    new NextRequest("http://localhost/api/bookings/guest-cancel", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.findUnique.mockResolvedValue({
    id: "b-legacy",
    guestId: null,
    guestEmail: "ada@example.com",
    status: "APPROVED",
    guest: null,
  });
  m.cancel.mockResolvedValue({ ok: true, fullRefund: true });
});

describe("eski hesapsiz rezervasyon: yonetim bagiyla iptal", () => {
  it("bagdaki e-posta rezervasyonla eslesirse iptal edilir", async () => {
    const res = await cancelWith("Ada@Example.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, fullRefund: true });
    expect(m.cancel).toHaveBeenCalledWith("b-legacy");
  });

  it("baska e-postanin bagi iptal edemez", async () => {
    const res = await cancelWith("eve@example.com");
    expect(res.status).toBe(403);
    expect(m.cancel).not.toHaveBeenCalled();
  });
});
