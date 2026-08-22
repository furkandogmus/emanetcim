/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/health/jobs — zamanlanmış işlerin gerçekten çalıştığını ölçen kontrol.
 *
 * Bu testlerin amacı iki yönlü: kontrol GERÇEKTEN bozuk olduğunda alarm vermeli,
 * ama en az o kadar önemlisi, sağlıklıyken ya da uygulanamazken SUSMALI. Sürekli
 * kırmızı yanan bir sağlık kontrolü, hiç olmayandan daha kötüdür — kimse bakmaz.
 */

const { mockPrisma, mockOverdueScan, mockSealCheck, mockReachCheck, mockJobHealth } = vi.hoisted(() => ({
  // Varsayilan: tum enforced isler taze.
  mockJobHealth: vi.fn().mockResolvedValue({
    checkedAt: new Date().toISOString(),
    jobs: [],
    enforcedStale: 0,
    neverRun: 0,
    status: "ok",
  }),
  // Varsayilan: tum partnerlere ulasilabiliyor.
  mockReachCheck: vi.fn().mockResolvedValue({
    checkedAt: new Date().toISOString(),
    totalPartners: 3,
    unreachable: 0,
    phoneOnly: 2,
    emailOnly: 1,
    unreachableWithActiveShop: 0,
    status: "ok",
  }),
  // Varsayilan: muhur envanteri saglam.
  mockSealCheck: vi.fn().mockResolvedValue({
    checkedAt: new Date().toISOString(),
    orphanedNonStock: 0,
    stockWithShop: 0,
    total: 0,
    byStatus: {},
    checkedInWithoutSeals: 0,
    status: "ok",
  }),
  mockPrisma: {
    shopTimeSlot: { aggregate: vi.fn(), count: vi.fn() },
    shop: { count: vi.fn() },
  },
  // Varsayılan: hiç gecikme yok. Böylece slot testleri süre aşımı sinyalinden
  // etkilenmez; gecikmeyi ölçen testler kendi değerini verir.
  mockOverdueScan: vi.fn().mockResolvedValue({
    scannedAt: new Date().toISOString(),
    overdueCount: 0,
    bagsInShopCount: 0,
    byTier: { day_1: 0, day_3: 0, week_1: 0, month_1: 0 },
    eventsRecorded: 0,
    oldestOverdueHours: 0,
    items: [],
  }),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/OverdueBookingService", () => ({
  overdueBookingService: { scan: mockOverdueScan },
}));
vi.mock("@/services/SealIntegrityService", () => ({
  sealIntegrityService: { check: mockSealCheck },
}));
vi.mock("@/services/PartnerReachabilityService", () => ({
  partnerReachabilityService: { check: mockReachCheck },
}));
vi.mock("@/services/JobHealthService", () => ({
  jobHealthService: { check: mockJobHealth },
}));
vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { GET } = await import("../app/api/health/jobs/route");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Slot ufkunu "bugunden N gun sonra" olarak kur. */
function setup(opts: {
  horizonDays: number | null;
  activeShops: number;
  futureSlots?: number;
}) {
  mockPrisma.shopTimeSlot.aggregate.mockResolvedValue({
    _max: {
      startTime:
        opts.horizonDays === null
          ? null
          : new Date(Date.now() + opts.horizonDays * MS_PER_DAY + 60_000),
    },
  });
  mockPrisma.shop.count.mockResolvedValue(opts.activeShops);
  mockPrisma.shopTimeSlot.count.mockResolvedValue(opts.futureSlots ?? 100);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/health/jobs", () => {
  it("is taze calistiysa 200 ve UP doner", async () => {
    setup({ horizonDays: 30, activeShops: 3 });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("UP");
    expect(body.checks.slotGeneration.status).toBe("ok");
    expect(body.checks.slotGeneration.estimatedDaysSinceLastRun).toBe(0);
  });

  it("esik degerinde (28 gun) hala saglikli sayilir", async () => {
    setup({ horizonDays: 28, activeShops: 3 });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).checks.slotGeneration.status).toBe("ok");
  });

  it("is ~3 gundur calismadiysa 503 verir", async () => {
    setup({ horizonDays: 27, activeShops: 3 });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("DEGRADED");
    expect(body.checks.slotGeneration.status).toBe("stale");
    expect(body.checks.slotGeneration.estimatedDaysSinceLastRun).toBe(3);
  });

  it("2026-07-14'teki gercek kesintiyi yakalar (hic gelecek slot yok)", async () => {
    // Gercek senaryo: uretim durdu, tum slotlar gecmiste kaldi.
    setup({ horizonDays: null, activeShops: 3, futureSlots: 0 });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.slotGeneration.status).toBe("stale");
    expect(body.checks.slotGeneration.horizonDays).toBe(0);
    expect(body.checks.slotGeneration.futureSlotCount).toBe(0);
  });

  it("aktif dukkan yoksa SUSAR (uygulanamaz), yanlis alarm vermez", async () => {
    // Yeni bir ortamda hic dukkan yoksa slot beklentisi de yoktur; burada 503
    // dondurmek sonsuza kadar kirmizi yanan bir kontrol yaratirdi.
    setup({ horizonDays: null, activeShops: 0, futureSlots: 0 });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("UP");
    expect(body.checks.slotGeneration.status).toBe("not_applicable");
    expect(body.checks.slotGeneration.estimatedDaysSinceLastRun).toBeNull();
  });

  it("veritabani hata verirse DOWN + 503 doner", async () => {
    mockPrisma.shopTimeSlot.aggregate.mockRejectedValue(new Error("db down"));
    mockPrisma.shop.count.mockRejectedValue(new Error("db down"));
    mockPrisma.shopTimeSlot.count.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe("DOWN");
  });

  it("aktif dukkan sayisini baglam olarak bildirir", async () => {
    setup({ horizonDays: 30, activeShops: 7 });
    const body = await (await GET()).json();
    expect(body.context.activeShopCount).toBe(7);
  });
});

describe("GET /api/health/jobs — sure asimi mutabakati", () => {
  beforeEach(() => {
    // Slot tarafi saglikli: yalnizca sure asimi sinyalini olcuyoruz.
    setup({ horizonDays: 30, activeShops: 5 });
  });

  it("gecikme yoksa UP", async () => {
    mockOverdueScan.mockResolvedValueOnce({
      overdueCount: 0,
      oldestOverdueHours: 0,
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.overdueReconciliation.status).toBe("ok");
  });

  it("kisa gecikme alarm vermez — normal operasyon", async () => {
    mockOverdueScan.mockResolvedValueOnce({
      overdueCount: 5,
      oldestOverdueHours: 30,
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.overdueReconciliation.status).toBe("ok");
    // Sayi degil YAS sinyal: 5 tane bir gunluk gecikme normal.
    expect(body.checks.overdueReconciliation.overdueCount).toBe(5);
  });

  it("72 saati asan TEK bir rezervasyon 503 verir", async () => {
    mockOverdueScan.mockResolvedValueOnce({
      overdueCount: 1,
      oldestOverdueHours: 100,
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("DEGRADED");
    expect(body.checks.overdueReconciliation.status).toBe("stale");
  });

  it("2026-08-22'deki gercek durumu yakalar (Haziran'dan beri acik)", async () => {
    // Prod'da 19 rezervasyonun 18'i cikis saatini gecmis haldeydi; en eskisi
    // 12 Haziran'dan beri CHECKED_IN — yaklasik 1700 saat.
    mockOverdueScan.mockResolvedValueOnce({
      overdueCount: 18,
      oldestOverdueHours: 1700,
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.checks.overdueReconciliation.oldestOverdueHours).toBe(1700);
  });

  it("saglik kontrolu HICBIR SEY YAZMAZ — yan etkisiz olmali", async () => {
    await GET();

    expect(mockOverdueScan).toHaveBeenCalledWith(
      expect.objectContaining({ recordEvents: false }),
    );
  });
});

describe("GET /api/health/jobs — muhur envanteri butunlugu", () => {
  beforeEach(() => {
    setup({ horizonDays: 30, activeShops: 5 });
  });

  it("envanter saglamsa UP", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.sealIntegrity.status).toBe("ok");
  });

  it("2026-08-22'deki gercek durumu yakalar (1.247 sahipsiz ASSIGNED)", async () => {
    mockSealCheck.mockResolvedValueOnce({
      orphanedNonStock: 1247,
      stockWithShop: 0,
      total: 1301,
      byStatus: { ASSIGNED: 1277, STOCK: 22, FAULTY: 2 },
      checkedInWithoutSeals: 3,
      status: "broken",
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("DEGRADED");
    expect(body.checks.sealIntegrity.orphanedNonStock).toBe(1247);
  });

  it("STOCK oldugu halde dukkana bagli muhur de bozukluktur", async () => {
    mockSealCheck.mockResolvedValueOnce({
      orphanedNonStock: 0,
      stockWithShop: 4,
      total: 100,
      byStatus: {},
      checkedInWithoutSeals: 0,
      status: "broken",
    } as any);

    const res = await GET();

    expect(res.status).toBe(503);
  });

  it("uc kontrolden biri bozuksa tumu DEGRADED — digerleri maskelemez", async () => {
    mockSealCheck.mockResolvedValueOnce({
      orphanedNonStock: 1,
      stockWithShop: 0,
      total: 1,
      byStatus: {},
      checkedInWithoutSeals: 0,
      status: "broken",
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(body.checks.slotGeneration.status).toBe("ok");
    expect(body.checks.overdueReconciliation.status).toBe("ok");
    expect(body.checks.sealIntegrity.status).toBe("broken");
    expect(res.status).toBe(503);
  });
});

describe("GET /api/health/jobs — partner ulasilabilirligi", () => {
  beforeEach(() => {
    setup({ horizonDays: 30, activeShops: 5 });
  });

  it("herkese ulasilabiliyorsa UP", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.partnerReachability.status).toBe("ok");
  });

  it("yalnizca telefonu olan partner SORUN DEGIL — esnaf girisi telefon tabanli", async () => {
    // P1-16'da tespit edildi: e-postasiz partner bir bozulma degil, tasarimin
    // sonucu. Alarm yalnizca HICBIR kanali olmayan icin calismali.
    mockReachCheck.mockResolvedValueOnce({
      totalPartners: 3,
      unreachable: 0,
      phoneOnly: 2,
      emailOnly: 1,
      unreachableWithActiveShop: 0,
      status: "ok",
    } as any);

    const res = await GET();

    expect(res.status).toBe(200);
  });

  it("hicbir kanali olmayan partner 503 verir", async () => {
    mockReachCheck.mockResolvedValueOnce({
      totalPartners: 3,
      unreachable: 1,
      phoneOnly: 1,
      emailOnly: 1,
      unreachableWithActiveShop: 1,
      status: "broken",
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.checks.partnerReachability.unreachableWithActiveShop).toBe(1);
  });
});

describe("GET /api/health/jobs — is calistirma defteri", () => {
  beforeEach(() => {
    setup({ horizonDays: 30, activeShops: 5 });
  });

  it("tum enforced isler tazeyse UP", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.scheduledJobs.status).toBe("ok");
  });

  it("enforced bir is gecikmisse 503", async () => {
    mockJobHealth.mockResolvedValueOnce({
      jobs: [{ job: "generate-slots", enforced: true, status: "stale", hoursSinceSuccess: 900 }],
      enforcedStale: 1,
      neverRun: 0,
      status: "stale",
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.checks.scheduledJobs.enforcedStale).toBe(1);
  });

  it("cron'u KURULMAMIS is (enforced=false) alarm URETMEZ", async () => {
    // Kurulmamis bir is "bozuk" degil "beklemede"dir. Onu kirmizi saymak kalici
    // kirmizi bir saglik kontrolu demektir -- kimsenin bakmadigi kontrol.
    mockJobHealth.mockResolvedValueOnce({
      jobs: [
        { job: "overdue-scan", enforced: false, status: "never_run", hoursSinceSuccess: null },
      ],
      enforcedStale: 0,
      neverRun: 1,
      status: "ok",
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.scheduledJobs.neverRun).toBe(1);
  });

  it("2026-07-14 kesintisini defterden de yakalar", async () => {
    // Slot ufku olcusu bunu zaten yakaliyordu ama YALNIZCA o is icin. Defter
    // olcuyu genellestirir: 37 gun = 888 saat.
    mockJobHealth.mockResolvedValueOnce({
      jobs: [
        {
          job: "generate-slots",
          enforced: true,
          status: "stale",
          hoursSinceSuccess: 888,
          maxStaleHours: 48,
        },
      ],
      enforcedStale: 1,
      neverRun: 0,
      status: "stale",
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.checks.scheduledJobs.jobs[0].hoursSinceSuccess).toBe(888);
  });
});
