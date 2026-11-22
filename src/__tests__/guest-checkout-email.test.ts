import { describe, it, expect, vi, beforeEach } from "vitest";
import { decodeJwt } from "jose";

/**
 * Hesapsiz web checkout (kural 1a/1b, 2026-11-22): e-posta zorunlu (SERVISTE),
 * onay e-postasi imzali, tek rezervasyonluk bir yonetim bagi tasir.
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

const { createInitialBooking } = await import("@/services/booking/create");
const { signGuestManageLinkToken, authenticateGuestLookup } = await import("@/lib/guest-lookup-token");
const { NotificationService } = await import("@/services/NotificationService");

const base = {
  shopId: "s1",
  guestId: null,
  totalPrice: 100,
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  checkInTime: new Date(Date.now() + 3600_000),
  checkOutTime: new Date(Date.now() + 7200_000),
};

async function rejection(data: Record<string, unknown>) {
  try {
    await createInitialBooking({ ...base, ...data } as never);
    return null;
  } catch (e) {
    return e as { code?: string };
  }
}

describe("hesapsiz rezervasyon e-posta kapisi (servis)", () => {
  it("e-postasiz reddedilir", async () => {
    expect((await rejection({}))?.code).toBe("GUEST_EMAIL_REQUIRED");
  });

  it("YALNIZ telefonla reddedilir", async () => {
    expect((await rejection({ guestPhone: "5551112233" }))?.code).toBe("GUEST_EMAIL_REQUIRED");
  });

  it("bicimsiz e-posta reddedilir", async () => {
    expect((await rejection({ guestEmail: "ada@" }))?.code).toBe("GUEST_EMAIL_REQUIRED");
  });

  it("gecerli e-posta (telefonsuz) bu kapidan gecer", async () => {
    const e = await rejection({ guestEmail: "Ada@Example.com" });
    expect(e?.code).not.toBe("GUEST_EMAIL_REQUIRED");
  });

  it("oturumlu misafirde e-posta istenmez", async () => {
    const e = await rejection({ guestId: "u1" });
    expect(e?.code).not.toBe("GUEST_EMAIL_REQUIRED");
  });
});

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

  it("hesapsiz rezervasyonda 'Rezervasyonunu yonet' bagi imzali token tasir", async () => {
    await new NotificationService().notifyBookingSuccess("ada@example.com", "b1", 100, "tr", {
      guestManage: { checkOutTime: new Date(Date.now() + 3600_000) },
    });
    const { html, text } = sentBody();
    expect(html).toContain("Rezervasyonunu yönet");
    const m = html.match(/https:\/\/example\.test\/tr\/bookings\/manage\/([\w.-]+)/);
    expect(m).not.toBeNull();
    expect(text).toContain(m![0]);
    const auth = await authenticateGuestLookup(`Bearer ${m![1]}`);
    expect(auth).toEqual({ ok: true, claims: { bookingId: "b1", email: "ada@example.com" } });
  });

  it("hesapli rezervasyonda bilet sayfasi bagi kalir", async () => {
    await new NotificationService().notifyBookingSuccess("ada@example.com", "b1", 100, "tr");
    const { html } = sentBody();
    expect(html).toContain("https://example.test/tr/bookings/b1");
    expect(html).not.toContain("/bookings/manage/");
  });
});
