import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * D7 bildirim bosluklari: sikayet sonucu -> misafir (G34), misafir olaylari web push'a da
 * (G37), bekleyen rol degisikligi -> diger yoneticiler, destek mesaji -> yonetici push'u
 * (birlestirilmis).
 */

const m = vi.hoisted(() => ({
  prisma: {
    notificationLog: { create: vi.fn(), findFirst: vi.fn() },
    pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() },
    mobilePushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
    booking: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    contactMessage: { count: vi.fn() },
  },
  sendNotification: vi.fn(),
  sendEachForMulticast: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: m.sendNotification } }));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), getApps: vi.fn().mockReturnValue([]), cert: vi.fn((v) => v) }));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: vi.fn(() => ({ sendEachForMulticast: m.sendEachForMulticast })) }));

import { NotificationService, CONTACT_PUSH_COALESCE_MS } from "@/services/NotificationService";

let service = new NotificationService();
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const BOOKING = {
  guestId: "guest-1",
  locale: "de",
  guestEmail: null,
  guest: { email: "gast@example.com" },
  shop: { name: "Laden & Co" },
};

/** Resend'e giden govdeler. */
const sentEmails = () => fetchMock.mock.calls.map((c) => JSON.parse((c[1] as { body: string }).body));
const webPayloads = () => m.sendNotification.mock.calls.map((c) => JSON.parse(c[1] as string));

beforeEach(() => {
  vi.clearAllMocks();
  // Birlestirme durumu ornekte tutulur; her test temiz baslar.
  service = new NotificationService();
  process.env.RESEND_API_KEY = "test_key";
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "p" });
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "r1" }) });
  m.prisma.booking.findUnique.mockResolvedValue(BOOKING);
  m.prisma.mobilePushToken.findMany.mockResolvedValue([{ token: "fcm-1", locale: "tr" }]);
  m.prisma.pushSubscription.findMany.mockResolvedValue([{ id: "s1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" }]);
  m.sendNotification.mockResolvedValue({});
  m.sendEachForMulticast.mockResolvedValue({ successCount: 1, responses: [{ success: true }] });
});

describe("misafir olaylari web push'a da gider (G37)", () => {
  it("mobil ve web push ayni dilde ayni metni alir", async () => {
    service.pushGuestOnly("b1", "checkIn", "en");
    await vi.waitFor(() => expect(m.sendNotification).toHaveBeenCalledTimes(1));
    expect(m.prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: "guest-1" } });
    expect(webPayloads()[0]).toEqual({
      title: "Your bags are checked in",
      body: "Laden & Co checked in your bags. Show your QR code at pickup.",
      bookingId: "b1",
    });
    expect(m.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ notification: { title: "Your bags are checked in", body: expect.any(String) } }),
    );
  });

  it("aboneligi olmayan misafire web push gitmez, mobil yine gider", async () => {
    m.prisma.pushSubscription.findMany.mockResolvedValue([]);
    service.pushGuestOnly("b1", "approved", "tr");
    await vi.waitFor(() => expect(m.sendEachForMulticast).toHaveBeenCalled());
    expect(m.sendNotification).not.toHaveBeenCalled();
  });

  it("gec birakma: yalnizca web push gittiyse e-posta yine gider", async () => {
    m.prisma.mobilePushToken.findMany.mockResolvedValue([]);
    const r = await service.sendLateDropoffNotice({
      bookingId: "b1",
      kind: "reminder",
      locale: "tr",
      email: "misafir@example.com",
      hasAccount: true,
      at: new Date("2026-11-24T10:00:00Z"),
      checkOutAt: new Date("2026-11-24T18:00:00Z"),
      shop: { name: "Dukkan", phone: null, timeZone: "Europe/Istanbul" },
    });
    expect(m.sendNotification).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ push: false, email: true });
  });
});

describe("sikayet sonucu -> misafir (G34)", () => {
  it("misafirin dilinde e-posta + push; uyusmazlik sayfasina baglar, yonetici notu yok", async () => {
    await service.notifyGuestDisputeOutcome({ bookingId: "b1", status: "RESOLVED" });
    await vi.waitFor(() => expect(m.sendNotification).toHaveBeenCalledTimes(1));

    const [mail] = sentEmails();
    expect(mail.to).toEqual(["gast@example.com"]);
    expect(mail.subject).toBe("BagajPark: Deine Beschwerde wurde gelöst");
    expect(mail.html).toContain("/de/bookings/b1/dispute");
    // Dukkan adi HTML'de kacirilir, duz metinde oldugu gibi.
    expect(mail.html).toContain("Laden &amp; Co");
    expect(mail.text).toContain("Laden & Co");

    expect(webPayloads()[0]).toMatchObject({ title: "Deine Beschwerde wurde gelöst", url: "/bookings/b1/dispute" });
    expect(m.sendEachForMulticast).toHaveBeenCalledWith(expect.objectContaining({ data: { bookingId: "b1" } }));
    expect(m.prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "EMAIL", bookingId: "b1" }) }),
    );
  });

  it("e-postasi olmayan misafir yalnizca push alir", async () => {
    m.prisma.booking.findUnique.mockResolvedValue({ ...BOOKING, guest: { email: null }, locale: null });
    await service.notifyGuestDisputeOutcome({ bookingId: "b1", status: "IN_REVIEW" });
    await vi.waitFor(() => expect(m.sendNotification).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    // Dili bilinmeyen rezervasyon Turkce'ye duser.
    expect(webPayloads()[0].title).toBe("Şikayetin inceleniyor");
  });
});

describe("bekleyen rol degisikligi -> diger yoneticiler", () => {
  it("isteyen yonetici ne push ne e-posta alir", async () => {
    m.prisma.user.findMany.mockResolvedValue([{ email: "admin2@example.com" }]);
    await service.notifyAdminsForPendingRoleChange({
      requestedByUserId: "admin-1",
      targetName: "Ayse",
      previousRole: "PARTNER",
      requestedRole: "ADMIN",
    });
    await vi.waitFor(() => expect(m.sendEachForMulticast).toHaveBeenCalled());

    expect(m.prisma.mobilePushToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: { notIn: ["admin-1"] } }) }),
    );
    expect(m.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: { title: "Rol değişikliği onay bekliyor", body: "Ayse için Yönetici rolü ikinci yönetici onayını bekliyor." },
        data: { adminScreen: "roleApprovals" },
      }),
    );
    expect(m.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: "ADMIN", id: { not: "admin-1" } }) }),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentEmails()[0].to).toEqual(["admin2@example.com"]);
  });
});

describe("destek mesaji -> yonetici push'u (birlestirilmis)", () => {
  it("ilk mesajda okunmamis sayisiyla push; Mesajlar sekmesine acilir", async () => {
    m.prisma.notificationLog.findFirst.mockResolvedValue(null);
    m.prisma.contactMessage.count.mockResolvedValue(3);
    const now = new Date("2026-11-24T12:00:00Z");
    await expect(service.notifyAdminsForContactMessage(now)).resolves.toBe(true);

    expect(m.prisma.notificationLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: new Date(now.getTime() - CONTACT_PUSH_COALESCE_MS) } }),
      }),
    );
    expect(m.prisma.contactMessage.count).toHaveBeenCalledWith({ where: { category: "SUPPORT", isRead: false } });
    expect(m.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: { title: "Yeni destek mesajı", body: "3 okunmamış mesaj var." },
        data: { adminScreen: "messages" },
      }),
    );
  });

  it("baska surecin gonderimi (kayit defteri) pencereyi acar; pencere sonunda takip push'u", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-11-24T12:00:00Z");
      vi.setSystemTime(now);
      m.prisma.notificationLog.findFirst.mockResolvedValue({ createdAt: new Date(now.getTime() - 60_000) });
      m.prisma.contactMessage.count.mockResolvedValue(2);
      await expect(service.notifyAdminsForContactMessage(now)).resolves.toBe(false);
      expect(m.sendEachForMulticast).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(CONTACT_PUSH_COALESCE_MS - 60_000 - 1);
      expect(m.sendEachForMulticast).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await vi.waitFor(() =>
        expect(m.sendEachForMulticast).toHaveBeenCalledWith(
          expect.objectContaining({ notification: { title: "Yeni destek mesajı", body: "2 okunmamış mesaj var." } }),
        ),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("pencere icinde gelen mesajlar tek takip push'unda toplanir", async () => {
    vi.useFakeTimers();
    try {
      m.prisma.notificationLog.findFirst.mockResolvedValue(null);
      m.prisma.contactMessage.count.mockResolvedValue(1);
      const t0 = new Date("2026-11-24T12:00:00Z");
      vi.setSystemTime(t0);
      await expect(service.notifyAdminsForContactMessage(t0)).resolves.toBe(true);
      expect(m.sendEachForMulticast).toHaveBeenCalledTimes(1);

      m.prisma.contactMessage.count.mockResolvedValue(4);
      await service.notifyAdminsForContactMessage(new Date(t0.getTime() + 60_000));
      await service.notifyAdminsForContactMessage(new Date(t0.getTime() + 120_000));
      expect(m.sendEachForMulticast).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(CONTACT_PUSH_COALESCE_MS);
      await vi.waitFor(() => expect(m.sendEachForMulticast).toHaveBeenCalledTimes(2));
      expect(m.sendEachForMulticast).toHaveBeenLastCalledWith(
        expect.objectContaining({ notification: expect.objectContaining({ body: "4 okunmamış mesaj var." }) }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("takip aninda okunmamis kalmadiysa push gitmez", async () => {
    vi.useFakeTimers();
    try {
      m.prisma.notificationLog.findFirst.mockResolvedValue(null);
      m.prisma.contactMessage.count.mockResolvedValue(1);
      const t0 = new Date();
      await service.notifyAdminsForContactMessage(t0);
      await service.notifyAdminsForContactMessage(new Date(t0.getTime() + 1_000));
      m.prisma.contactMessage.count.mockResolvedValue(0);
      await vi.advanceTimersByTimeAsync(CONTACT_PUSH_COALESCE_MS);
      expect(m.sendEachForMulticast).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gonderim hatasi pencereyi baslatmaz; sonraki mesaj hemen push'lanir", async () => {
    m.prisma.notificationLog.findFirst.mockResolvedValue(null);
    m.prisma.contactMessage.count.mockRejectedValueOnce(new Error("db down")).mockResolvedValue(1);
    await expect(service.notifyAdminsForContactMessage()).rejects.toThrow("db down");
    await expect(service.notifyAdminsForContactMessage()).resolves.toBe(true);
    expect(m.sendEachForMulticast).toHaveBeenCalledTimes(1);
  });
});

describe("misafir web push'u: abonelik yoksa kayit satiri yazilmaz", () => {
  it("SKIPPED no_subscriptions satiri yok, mobil satiri var", async () => {
    m.prisma.pushSubscription.findMany.mockResolvedValue([]);
    service.pushGuestOnly("b1", "checkOut", "tr");
    await vi.waitFor(() => expect(m.prisma.notificationLog.create).toHaveBeenCalled());
    const types = m.prisma.notificationLog.create.mock.calls.map((c) => c[0].data.type);
    expect(types).toEqual(["MOBILE_PUSH"]);
  });

  it("gercek web push hatasi yine kaydedilir", async () => {
    m.sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    service.pushGuestOnly("b1", "checkOut", "tr");
    await vi.waitFor(() =>
      expect(m.prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: "PUSH", status: "FAILED" }) }),
      ),
    );
  });

  it("dogrudan sendPush cagrisi (esnaf) SKIPPED yazmaya devam eder", async () => {
    m.prisma.pushSubscription.findMany.mockResolvedValue([]);
    await service.sendPush("partner-1", "t", "b");
    expect(m.prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "PUSH", status: "SKIPPED", error: "no_subscriptions" }) }),
    );
  });
});

describe("destek mesaji tasiyicilari push'u tetikler", () => {
  it("iletisim formu ve gelen posta (yalnizca SUPPORT) ayni yontemi cagirir", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/actions/contact.ts", "utf-8")).toMatch(/notifyAdminsForContactMessage\(\)\s*\.catch/);
    const hook = readFileSync("src/app/api/webhooks/resend/route.ts", "utf-8");
    expect(hook).toMatch(/category === "SUPPORT"\) \{\s*void notificationService\s*\.notifyAdminsForContactMessage\(\)\s*\.catch/);
  });
});
