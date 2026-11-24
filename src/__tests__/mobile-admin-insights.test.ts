import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil yonetici gorunurluk uclari: analitik, sistem, bildirim defteri, on acilis.
 * Hepsi salt okuma; web sayfasiyla ayni servis govdesini okur.
 */
const { mockPrisma, mockRequireMobileUser } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    analyticsEvent: { groupBy: vi.fn(), findMany: vi.fn() },
    shop: { findMany: vi.fn() },
    jobRun: { groupBy: vi.fn(), findMany: vi.fn() },
    platformSettings: { findUnique: vi.fn() },
    notificationLog: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  },
  mockRequireMobileUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));

import * as analyticsRoute from "@/app/api/mobile/admin/analytics/route";
import * as systemRoute from "@/app/api/mobile/admin/system/route";
import * as logsRoute from "@/app/api/mobile/admin/notification-logs/route";
import * as prelaunchRoute from "@/app/api/mobile/admin/prelaunch/route";
import { healthLevelFor } from "@/services/SystemStatusService";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";
import { JOB_REGISTRY } from "@/lib/jobs/registry";

const ADMIN = { id: "a1", role: "ADMIN" as const, email: "a@x.com" };
const req = (path: string) =>
  new NextRequest(`https://bagajpark.com/api/mobile/admin${path}`, { headers: { authorization: "Bearer t" } });
const json = async (r: Response | undefined) => ({ status: r!.status, body: await r!.json() });

const LOG = {
  id: "n1",
  bookingId: "b1",
  type: "EMAIL_CONFIRMATION",
  recipient: "misafir@example.com",
  subject: "Onay",
  content: "Merhaba",
  status: "FAILED",
  error: "bounce",
  createdAt: new Date("2026-11-20T10:00:00Z"),
  providerMessageId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: ADMIN });
  mockPrisma.$queryRaw.mockResolvedValue([]);
  mockPrisma.analyticsEvent.groupBy.mockResolvedValue([]);
  mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
  mockPrisma.shop.findMany.mockResolvedValue([]);
  mockPrisma.jobRun.groupBy.mockResolvedValue([]);
  mockPrisma.jobRun.findMany.mockResolvedValue([]);
  mockPrisma.platformSettings.findUnique.mockResolvedValue(null);
  mockPrisma.notificationLog.findMany.mockResolvedValue([LOG]);
  mockPrisma.notificationLog.groupBy.mockResolvedValue([]);
  mockPrisma.notificationLog.count.mockResolvedValue(3);
});

const ROUTES: [string, () => Promise<Response | undefined>][] = [
  ["analytics", () => analyticsRoute.GET(req("/analytics"))],
  ["system", () => systemRoute.GET(req("/system"))],
  ["notification-logs", () => logsRoute.GET(req("/notification-logs"))],
  ["prelaunch", () => prelaunchRoute.GET(req("/prelaunch"))],
];

describe("yetki", () => {
  it.each(ROUTES)("%s: yonetici olmayan 403", async (_n, call) => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, role: "PARTNER" } });
    expect(await json(await call())).toEqual({ status: 403, body: { error: "forbidden" } });
  });
});

describe("analitik", () => {
  it("izinli araligi kullanir, taninmayan deger 30 gune duser", async () => {
    mockPrisma.analyticsEvent.groupBy.mockResolvedValueOnce([{ name: "page_view", _count: { _all: 12 } }]);
    const r = await json(await analyticsRoute.GET(req("/analytics?days=7")));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ days: 7, pageViews: 12, searches: 0, topPaths: [], topShops: [] });
    const bogus = await json(await analyticsRoute.GET(req("/analytics?days=365")));
    expect(bogus.body.days).toBe(30);
  });
});

describe("sistem", () => {
  it("saglik, is listesi (gecikme aciklamasiyla) ve uygulama surum kapisini tek yanitta verir", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue({ minAppVersion: "0.3.0", latestAppVersion: "0.3.4" });
    const r = await json(await systemRoute.GET(req("/system")));
    expect(r.status).toBe(200);
    expect(r.body.jobs).toHaveLength(JOB_REGISTRY.length);
    expect(r.body.jobs[0].ifItStops).toBe(JOB_REGISTRY[0].ifItStops);
    expect(r.body.jobs[0].status).toBe("never_run");
    expect(r.body.appVersions).toEqual({ min: "0.3.0", latest: "0.3.4" });
    expect(typeof r.body.serverVersion).toBe("string");
    expect(["ok", "warning", "error"]).toContain(r.body.healthLevel);
    expect(r.body.checks).toHaveProperty("database");
  });

  it("veritabani yanit vermezse kontrol `error` olur, uc yine 200 doner", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("down"));
    const r = await json(await systemRoute.GET(req("/system")));
    expect(r.status).toBe(200);
    expect(r.body.checks.database).not.toBe("ok");
  });

  it("skor esikleri web ekraniyla ayni (90 / 60)", () => {
    expect(healthLevelFor(100)).toBe("ok");
    expect(healthLevelFor(90)).toBe("ok");
    expect(healthLevelFor(80)).toBe("warning");
    expect(healthLevelFor(60)).toBe("warning");
    expect(healthLevelFor(55)).toBe("error");
  });
});

describe("bildirim defteri", () => {
  it("suzgecleri servise verir; ilk sayfa secenekleri tasir", async () => {
    mockPrisma.notificationLog.groupBy
      .mockResolvedValueOnce([{ type: "EMAIL_CONFIRMATION" }])
      .mockResolvedValueOnce([{ status: "FAILED" }, { status: "SENT" }]);
    const r = await json(await logsRoute.GET(req("/notification-logs?status=FAILED&type=EMAIL_CONFIRMATION&q=misafir")));
    expect(r.status).toBe(200);
    const where = mockPrisma.notificationLog.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      AND: [
        { status: "FAILED" },
        { type: "EMAIL_CONFIRMATION" },
        { recipient: { contains: "misafir", mode: "insensitive" } },
      ],
    });
    expect(r.body.facets).toEqual({ types: ["EMAIL_CONFIRMATION"], statuses: ["FAILED", "SENT"], failedCount: 3 });
    expect(r.body.items[0]).toEqual({
      id: "n1",
      bookingId: "b1",
      type: "EMAIL_CONFIRMATION",
      recipient: "misafir@example.com",
      subject: "Onay",
      content: "Merhaba",
      status: "FAILED",
      error: "bounce",
      createdAt: "2026-11-20T10:00:00.000Z",
    });
  });

  it("gecersiz suzgec degeri yok sayilir; sonraki sayfa secenekleri yeniden saymaz", async () => {
    await logsRoute.GET(req("/notification-logs?status=x%20y&type=ALL&cursor=n1"));
    expect(mockPrisma.notificationLog.findMany.mock.calls[0][0].where).toBeUndefined();
    expect(mockPrisma.notificationLog.findMany.mock.calls[0][0].cursor).toEqual({ id: "n1" });
    expect(mockPrisma.notificationLog.groupBy).not.toHaveBeenCalled();
  });
});

describe("on acilis raporu", () => {
  const shop = (id: string, city: string | null, wants: number, emails: number) => ({
    id,
    name: `Nokta ${id}`,
    city,
    district: null,
    _count: { prelaunchWants: wants, prelaunchInterests: emails },
  });

  it("sifirlari ayiklar, sehir toplaminda iki sinyali toplar", async () => {
    mockPrisma.shop.findMany.mockResolvedValue([
      shop("p1", "Antalya", 3, 1),
      shop("p2", "Antalya", 0, 0),
      shop("p3", "Izmir", 1, 0),
      shop("p4", null, 0, 2),
    ]);
    const r = await prelaunchInterestService.adminReport();
    expect(r.totalPoints).toBe(4);
    expect(r.silentCount).toBe(1);
    expect(r.cities).toEqual([
      { city: "Antalya", count: 4 },
      { city: "—", count: 2 },
      { city: "Izmir", count: 1 },
    ]);
    expect(r.points.map((p) => p.shopId)).toEqual(["p1", "p3", "p4"]);
  });

  it("uc e-posta adreslerini tasimaz", async () => {
    mockPrisma.shop.findMany.mockResolvedValue([shop("p1", "Antalya", 1, 1)]);
    const r = await json(await prelaunchRoute.GET(req("/prelaunch")));
    expect(JSON.stringify(r.body)).not.toContain("@");
    expect(r.body.points[0]).toEqual({
      shopId: "p1",
      shopName: "Nokta p1",
      city: "Antalya",
      district: null,
      wantCount: 1,
      interestCount: 1,
    });
  });
});
