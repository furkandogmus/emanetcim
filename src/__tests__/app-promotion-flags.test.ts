import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Magaza bayraklari: ayar servisi (eski mobil surum alanlari gondermez),
 * onay e-postasindaki "Uygulamayi indir" satiri ve esnaf afisinin yetki kapisi.
 */

const { mockPrisma, mockAudit, mockRevalidate, mockAuth, mockRedirect } = vi.hoisted(() => ({
  mockPrisma: {
    platformSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    notificationLog: { create: vi.fn() },
    shop: { findMany: vi.fn(), findUnique: vi.fn() },
  },
  mockAudit: vi.fn(),
  mockRevalidate: vi.fn(),
  mockAuth: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAudit }));
vi.mock("@/lib/qr-svg", () => ({ qrSvg: vi.fn(async (text: string) => `<svg data-text="${text}"></svg>`) }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect, notFound: vi.fn() }));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (k: string) => k),
}));

import { updatePlatformSettings, getPlatformSettingsForAdmin } from "@/services/PlatformSettingsService";
import { invalidateAppStoreFlagsCache } from "@/lib/app-stores";
import { NotificationService } from "@/services/NotificationService";
import PartnerPosterPage from "@/app/[locale]/partner/poster/page";

const ROW = {
  id: "default",
  maxStayDays: 30,
  maxBagsPerSlot: 50,
  insuranceFeeTry: 0,
  earlyRefundRatio: 1,
  cancelFixedFeeTry: 0,
  latePickupFeeTry: 0,
  latePickupGraceMin: 15,
  checkInGraceMin: 30,
  requireSealsOnCheckIn: false,
  defaultShopCapacity: 10,
  defaultPricePerDay: 250,
  bagMultiplierS: 0.8,
  bagMultiplierM: 1,
  bagMultiplierXl: 1.5,
  platformHolidayDates: null,
  minAppVersion: null,
  latestAppVersion: null,
  iosAppStoreLive: false,
  androidPlayLive: false,
  updatedAt: new Date("2026-11-20T10:00:00Z"),
};

const ADMIN = { id: "a1", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  invalidateAppStoreFlagsCache();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "m1" }) }) as never;
  process.env.RESEND_API_KEY = "test_key";
});

async function formValues() {
  const { values } = await getPlatformSettingsForAdmin();
  const rest: Record<string, unknown> = { ...values };
  delete rest.iosAppStoreLive;
  delete rest.androidPlayLive;
  // Formlar bos surumu "" olarak gonderir (sema `null` kabul etmez).
  rest.minAppVersion = values.minAppVersion ?? "";
  rest.latestAppVersion = values.latestAppVersion ?? "";
  return rest;
}

describe("platform ayarlari: magaza bayraklari", () => {
  it("varsayilan kapali", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue(null);
    const { values } = await getPlatformSettingsForAdmin();
    expect(values.iosAppStoreLive).toBe(false);
    expect(values.androidPlayLive).toBe(false);
  });

  it("eski istemci alanlari gondermezse mevcut deger KORUNUR (kapatilmaz)", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue({ ...ROW, iosAppStoreLive: true });
    const res = await updatePlatformSettings(ADMIN, await formValues());
    expect(res).toEqual({ ok: true });
    const update = mockPrisma.platformSettings.upsert.mock.calls[0][0].update;
    expect(update.iosAppStoreLive).toBe(true);
    expect(update.androidPlayLive).toBe(false);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("bayrak degisince yazilir, sayfalar yeniden dogrulanir ve denetime girer", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue(ROW);
    const res = await updatePlatformSettings(ADMIN, { ...(await formValues()), iosAppStoreLive: true });
    expect(res).toEqual({ ok: true });
    expect(mockPrisma.platformSettings.upsert.mock.calls[0][0].update.iosAppStoreLive).toBe(true);
    expect(mockRevalidate).toHaveBeenCalledWith("/[locale]", "layout");
    expect(mockAudit.mock.calls[0][0].metadata.storeFlags).toEqual({ iosAppStoreLive: true, androidPlayLive: false });
  });

  it("bool olmayan deger reddedilir", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue(ROW);
    const res = await updatePlatformSettings(ADMIN, { ...(await formValues()), androidPlayLive: "yes" });
    expect(res).toEqual({ ok: false, reason: "invalid_data" });
  });
});

describe("onay e-postasi: Uygulamayi indir satiri", () => {
  const service = new NotificationService();
  const sentHtml = () => JSON.parse((global.fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0][1].body).html as string;

  it("hicbir magaza yayinda degilken satir yok", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue(ROW);
    await service.notifyBookingSuccess("guest@example.com", "b1", 500, "tr");
    const html = sentHtml();
    expect(html).not.toContain("Uygulamayı indir");
    expect(html).not.toContain("/badges/");
  });

  it("iOS yayindayken yalnizca App Store rozeti, bag email-onay kaynakli", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue({ ...ROW, iosAppStoreLive: true });
    await service.notifyBookingSuccess("guest@example.com", "b1", 500, "tr");
    const html = sentHtml();
    expect(html).toContain("Uygulamayı indir");
    expect(html).toContain("/badges/app-store-tr.png");
    expect(html).not.toContain("google-play");
    expect(html).toContain("/app?kaynak=email-onay");
  });

  it.each(["en", "de", "fr", "ja", "fa"])("%s dilinde de satir cevrili", async (locale) => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue({ ...ROW, iosAppStoreLive: true, androidPlayLive: true });
    await service.notifyBookingSuccess("guest@example.com", "b1", 500, locale);
    const html = sentHtml();
    expect(html).not.toContain("Uygulamayı indir");
    expect(html).toContain("/badges/google-play-tr.png");
  });
});

describe("esnaf QR afisi: yetki", () => {
  const params = Promise.resolve({ locale: "tr" });

  it("giris yapmamis ziyaretci girise yonlendirilir", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(PartnerPosterPage({ params })).rejects.toThrow(/REDIRECT:\/tr\/login/);
  });

  it("misafir rolu ana sayfaya yonlendirilir", async () => {
    mockAuth.mockResolvedValue({ user: { id: "g1", role: "GUEST" } });
    await expect(PartnerPosterPage({ params })).rejects.toThrow("REDIRECT:/tr");
  });

  it("esnaf baskasinin dukkanini ?shop= ile acamaz (kendi dukkanina duser)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
    mockPrisma.shop.findMany.mockResolvedValue([{ id: "own", name: "Kendi", isActive: true }]);
    const el = await PartnerPosterPage({ params, searchParams: Promise.resolve({ shop: "other" }) });
    expect(JSON.stringify(el)).toContain("kaynak=afis-own");
    expect(mockPrisma.shop.findUnique).not.toHaveBeenCalled();
  });

  it("yonetici herhangi bir dukkanin afisini acar", async () => {
    mockAuth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    mockPrisma.shop.findUnique.mockResolvedValue({ id: "any", name: "Herhangi" });
    const el = await PartnerPosterPage({ params, searchParams: Promise.resolve({ shop: "any" }) });
    expect(mockPrisma.shop.findUnique).toHaveBeenCalledWith({ where: { id: "any" }, select: { id: true, name: true } });
    expect(JSON.stringify(el)).toContain("Herhangi");
  });
});
