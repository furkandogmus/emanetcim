import { describe, it, expect, vi, beforeEach } from "vitest";
import { decodeJwt } from "jose";

/**
 * Hesapsiz rezervasyonun yonetim bagi (kural 1a/1b, 2026-11-22). Yeni hesapsiz
 * rezervasyon 2026-11-23'ten beri yaratilmiyor (`booking-login-required.test.ts`);
 * daha once yaratilanlarin bagi ve e-postasi calismaya devam etmeli.
 */
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { create: vi.fn(), findUnique: vi.fn() },
    notificationLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.stubEnv("AUTH_SECRET", "test-secret-guest-manage");
vi.stubEnv("RESEND_API_KEY", "re_test_placeholder");
vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test");

const { signGuestManageLinkToken, authenticateGuestLookup } = await import("@/lib/guest-lookup-token");
const { NotificationService } = await import("@/services/NotificationService");

describe("yonetim bagi token'i", () => {
  it("tek rezervasyon + e-posta kapsamli, bitis + 1 gun yasar, ayni dogrulamadan gecer", async () => {
    const checkOutTime = new Date(Date.now() + 3 * 24 * 3600_000);
    const token = await signGuestManageLinkToken({ bookingId: "b1", email: " Ada@Example.com ", checkOutTime });

    const auth = await authenticateGuestLookup(`Bearer ${token}`);
    expect(auth).toEqual({ ok: true, claims: { bookingId: "b1", email: "ada@example.com" } });

    const { exp, aud } = decodeJwt(token);
    expect(aud).toBe("bagajpark:guest-lookup");
    expect(exp).toBe(Math.floor((checkOutTime.getTime() + 24 * 3600_000) / 1000));
  });

  it("uzak bitiste verilisten en fazla 7 gun yasar", async () => {
    const now = new Date();
    const token = await signGuestManageLinkToken({
      bookingId: "b1",
      email: "a@b.co",
      checkOutTime: new Date(now.getTime() + 30 * 24 * 3600_000),
      now,
    });
    expect(decodeJwt(token).exp).toBe(Math.floor((now.getTime() + 7 * 24 * 3600_000) / 1000));
  });

  it("gecmis bitiste bile en az 1 saat yasar", async () => {
    const now = new Date();
    const token = await signGuestManageLinkToken({
      bookingId: "b1",
      email: "a@b.co",
      checkOutTime: new Date(now.getTime() - 5 * 24 * 3600_000),
      now,
    });
    expect(decodeJwt(token).exp).toBe(Math.floor((now.getTime() + 3600_000) / 1000));
  });

  it("imzasi bozulmus token reddedilir", async () => {
    const token = await signGuestManageLinkToken({
      bookingId: "b1",
      email: "a@b.co",
      checkOutTime: new Date(Date.now() + 3600_000),
    });
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "BB" : "AA");
    expect((await authenticateGuestLookup(`Bearer ${tampered}`)).ok).toBe(false);
  });
});

describe("onay e-postasi", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: "m1" }) });
    vi.stubGlobal("fetch", fetchMock);
  });

  function sentBody() {
    return JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string) as { html: string; text: string };
  }

  it("onay e-postasi bilet sayfasina gider (yeni rezervasyon hep hesapli)", async () => {
    await new NotificationService().notifyBookingSuccess("ada@example.com", "b1", 100, "tr");
    const { html } = sentBody();
    expect(html).toContain("https://example.test/tr/bookings/b1");
    expect(html).not.toContain("/bookings/manage/");
  });
});
