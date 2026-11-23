import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { findUnique: vi.fn() },
    mobilePushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
    notificationLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/guest-lookup-token", () => ({ signGuestManageLinkToken: vi.fn(async () => "signed-token") }));

import { NotificationService } from "@/services/NotificationService";

/** Gec birakma bildirimi: once push, ulasmazsa e-posta; metin saati dukkan diliminde yazar. */
const base = {
  bookingId: "b1",
  kind: "reminder" as const,
  hasAccount: false,
  locale: "en",
  at: new Date("2030-05-01T11:00:00Z"), // 14:00 Istanbul
  checkOutAt: new Date("2030-05-01T15:00:00Z"),
  shop: { name: "Ornek <Dukkan>", phone: "+90 555 000 0000", timeZone: "Europe/Istanbul" },
  now: new Date("2030-05-01T10:20:00Z"),
};

describe("sendLateDropoffNotice", () => {
  let service: NotificationService;
  let sendEmail: ReturnType<typeof vi.spyOn>;
  let sendMobilePush: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
    sendEmail = vi.spyOn(service, "sendEmail").mockResolvedValue(true);
    sendMobilePush = vi.spyOn(service, "sendMobilePush").mockResolvedValue(false);
    mockPrisma.booking.findUnique.mockResolvedValue({ guestId: "u1", shop: { name: base.shop.name } });
  });

  it("push ulastiysa e-posta GITMEZ; metin kapanis saatini ve dukkan telefonunu tasir", async () => {
    sendMobilePush.mockResolvedValue(true);
    const r = await service.sendLateDropoffNotice({ ...base, email: "guest@example.com" });
    expect(r).toEqual({ push: true, email: false });
    expect(sendEmail).not.toHaveBeenCalled();
    const [, title, body] = sendMobilePush.mock.calls[0];
    expect(title).toBe("Your drop-off time has passed");
    expect(body).toContain("2:00");
    // 10 haneli saklanan numara 0 ile gosterilir.
    expect(body).toContain("0555 000 00 00");
  });

  it("push ulasmadiysa e-posta yedegi; dukkan adi HTML'e kacirilir", async () => {
    const r = await service.sendLateDropoffNotice({ ...base, email: "guest@example.com" });
    expect(r).toEqual({ push: false, email: true });
    const [to, subject, text, , html] = sendEmail.mock.calls[0];
    expect(to).toBe("guest@example.com");
    expect(subject).toBe("BagajPark: Your drop-off time has passed");
    expect(text).toContain("/en/bookings/manage/signed-token");
    expect(html).toContain("Ornek &lt;Dukkan&gt;");
    expect(html).not.toContain("<Dukkan>");
  });

  it("kapandi: e-posta yeni rezervasyon aramasina yonlendirir", async () => {
    await service.sendLateDropoffNotice({ ...base, kind: "closed", email: "guest@example.com" });
    const [, subject, text] = sendEmail.mock.calls[0];
    expect(subject).toBe("BagajPark: Your booking was closed");
    expect(text).toContain("the drop-off time passed.");
    expect(text).toContain("/en/search");
  });

  it("e-postasiz ve cihazsiz misafir: hicbir kanal", async () => {
    expect(await service.sendLateDropoffNotice({ ...base, email: null })).toEqual({ push: false, email: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
