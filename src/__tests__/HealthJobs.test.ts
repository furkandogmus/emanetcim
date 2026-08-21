/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/health/jobs — zamanlanmış işlerin gerçekten çalıştığını ölçen kontrol.
 *
 * Bu testlerin amacı iki yönlü: kontrol GERÇEKTEN bozuk olduğunda alarm vermeli,
 * ama en az o kadar önemlisi, sağlıklıyken ya da uygulanamazken SUSMALI. Sürekli
 * kırmızı yanan bir sağlık kontrolü, hiç olmayandan daha kötüdür — kimse bakmaz.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    shopTimeSlot: { aggregate: vi.fn(), count: vi.fn() },
    shop: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
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
