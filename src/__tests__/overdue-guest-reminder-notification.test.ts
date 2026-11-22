import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_LOCALES } from "@/i18n/locales";
import { JOB_REGISTRY } from "@/lib/jobs/registry";
import { stripComments } from "./helpers/strip-comments";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { findUnique: vi.fn() },
    mobilePushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
    notificationLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/guest-lookup-token", () => ({
  signGuestManageLinkToken: vi.fn(async () => "signed-token"),
}));

import { NotificationService } from "@/services/NotificationService";

const SHOP = {
  name: "Kadikoy <Bufe>",
  address: "Moda Cd. 1",
  openingTime: "09:00",
  closingTime: "20:00",
  open247: false,
  timeZone: "Europe/Istanbul",
};
const base = {
  bookingId: "b1",
  hasAccount: true,
  locale: "en",
  checkOutAt: new Date("2026-11-20T10:00:00.000Z"),
  shop: SHOP,
  now: new Date("2026-11-22T10:00:00.000Z"),
};

/** pushGuest atesle-unut: mikro-gorevlerin bitmesini bekle. */
const flush = () => new Promise((r) => setTimeout(r, 10));

describe("sendOverdueGuestReminder kanallari", () => {
  let service: NotificationService;
  let sendEmail: ReturnType<typeof vi.spyOn>;
  let sendMobilePush: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
    sendEmail = vi.spyOn(service, "sendEmail").mockResolvedValue(true);
    sendMobilePush = vi.spyOn(service, "sendMobilePush").mockResolvedValue(false);
    mockPrisma.booking.findUnique.mockResolvedValue({ guestId: "u1", shop: { name: SHOP.name } });
  });

  it("e-postasiz misafire yalnizca push gider, bookingId ile (uygulama rezervasyonu acar)", async () => {
    await service.sendOverdueGuestReminder({ ...base, email: null });
    await flush();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendMobilePush).toHaveBeenCalledWith("u1", "Your bags are still at the shop", expect.any(String), "b1");
  });

  it("push cihazi olmayan misafir yine e-posta alir", async () => {
    // sendMobilePush false = cihaz yok / SKIPPED; e-posta buna bagli degil.
    await service.sendOverdueGuestReminder({ ...base, email: "guest@example.com" });
    await flush();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("hesapsiz misafirin e-postasinda push denenir ama guestId yok, e-posta imzali yonetim bagini tasir", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({ guestId: null, shop: { name: SHOP.name } });
    await service.sendOverdueGuestReminder({ ...base, hasAccount: false, email: "walkin@example.com" });
    await flush();
    expect(sendMobilePush).not.toHaveBeenCalled();
    const [, , text] = sendEmail.mock.calls[0] as [string, string, string];
    expect(text).toContain("/en/bookings/manage/signed-token");
  });

  it("e-posta dukkan adresini, saatlerini ve rezervasyon baglantisini tasir; dukkan adi kacirilir", async () => {
    await service.sendOverdueGuestReminder({ ...base, email: "guest@example.com" });
    const [, subject, text, , html] = sendEmail.mock.calls[0] as [string, string, string, string, string];
    expect(subject).toBe("BagajPark: Your luggage is still at the shop 🧳");
    expect(text).toContain("Moda Cd. 1");
    expect(text).toContain("09:00 - 20:00");
    expect(html).toContain("/en/bookings/b1");
    expect(html).toContain("Kadikoy &lt;Bufe&gt;");
    expect(html).not.toContain("Kadikoy <Bufe>");
  });

  it.each([...APP_LOCALES])("`%s`: kendi dilinde, ucretten soz etmeden", async (locale) => {
    await service.sendOverdueGuestReminder({ ...base, locale, email: "guest@example.com" });
    const [, subject, text, , html] = sendEmail.mock.calls[0] as [string, string, string, string, string];
    if (locale !== "tr") expect(subject).not.toContain("hâlâ dükkanda");
    expect(html).toContain(`lang="${locale}"`);
    // Ucret karari yok (2026-11-23): hicbir dilde ucret/ek odeme gecmez.
    expect(`${subject}\n${text}`).not.toMatch(/ücret|fee|charge|Gebühr|Zusatzkosten|frais|料金|هزینه/i);
  });
});

describe("booking-reminders isine bagli, yeni cron yok", () => {
  const route = stripComments(
    readFileSync(join(process.cwd(), "src/app/api/internal/booking-reminders/route.ts"), "utf-8"),
  );

  it("mevcut uc servisi cagiriyor; eski konu-oneki sayimi kalkti", () => {
    expect(route).toContain("overdueGuestReminderService.run({ now })");
    expect(route).not.toContain("sendOverdueGuestNotice");
    expect(route).not.toContain("OVERDUE_GUEST_NOTICE_SUBJECT_PREFIX");
  });

  it("kayit defterinde ayri bir is yok; booking-reminders 15 dakikada bir", () => {
    expect(JOB_REGISTRY.filter((j) => /overdue-guest|guest-overdue/.test(j.name))).toEqual([]);
    expect(JOB_REGISTRY.find((j) => j.name === "booking-reminders")?.cron).toBe("7,22,37,52 * * * *");
  });
});
