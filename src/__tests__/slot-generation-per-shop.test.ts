import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dukkan basina slot uretimi (2026-11-23 olayi).
 *
 * Yeni onaylanan bir dukkan web aramasinda cikmadi: `ShopTimeSlot` satiri
 * sifirdi ve slotlari yalnizca (haftalardir dusen) gece isi uretiyordu. Bu dosya
 * birim duzeyinde olcer: plan gece isiyle ayni, yalnizca o dukkana yazilir,
 * isletilmeyen dukkan atlanir, uzlastirma rezervasyonlu slota dokunmaz, hata
 * cagirani dusurmez. Gercek Postgres davranisi (kilit, tekil kisit, es
 * zamanli cagri) `slot-generation.integration.test.ts`te.
 */

const { tx, mockPrisma, mockLogger } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    shop: { findUnique: vi.fn() },
    shopWeeklyHours: { findMany: vi.fn() },
    shopClosure: { findMany: vi.fn() },
    shopTimeSlot: { createMany: vi.fn(), updateMany: vi.fn() },
    reservationSlot: { findMany: vi.fn() },
  };
  return {
    tx,
    mockPrisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      shop: { findMany: vi.fn() },
    },
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: mockLogger }));

import {
  fillMissingSlots,
  generateSlotsForShop,
  planSlotStarts,
  scheduleSlotGeneration,
  SLOT_HORIZON_DAYS,
} from "@/services/SlotService";

// Istanbul 2026-11-24 06:00 (03:00Z): gunun tum acik saatleri gelecekte.
const NOW = new Date("2026-11-24T03:00:00Z");
const SHOP = {
  id: "shop-a",
  open247: false,
  openingTime: "09:00",
  closingTime: "20:00",
  capacity: 10,
  timezone: "Europe/Istanbul",
  isActive: true,
  isTest: false,
  isPrelaunch: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  tx.shop.findUnique.mockResolvedValue(SHOP);
  tx.shopWeeklyHours.findMany.mockResolvedValue([]);
  tx.shopClosure.findMany.mockResolvedValue([]);
  tx.shopTimeSlot.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  tx.shopTimeSlot.updateMany.mockResolvedValue({ count: 0 });
  tx.$queryRaw.mockResolvedValue([]);
  tx.reservationSlot.findMany.mockResolvedValue([]);
});

describe("planSlotStarts", () => {
  it("09:00-20:00 dukkan: gunde 22 slot, ilki dukkan saatiyle 09:00", () => {
    const { starts } = planSlotStarts(SHOP, undefined, NOW, 1);
    expect(starts).toHaveLength(22);
    expect(starts[0].toISOString()).toBe("2026-11-24T06:00:00.000Z");
    expect(starts[21].toISOString()).toBe("2026-11-24T16:30:00.000Z");
  });

  it("ufuk gece isiyle AYNI sabit (30 gun)", () => {
    expect(SLOT_HORIZON_DAYS).toBe(30);
    const { starts } = planSlotStarts(SHOP, undefined, NOW);
    expect(starts).toHaveLength(30 * 22);
  });

  it("haftalik kapali gun ve izin gunu slot almaz", () => {
    // 2026-11-24 Sali (ISO 2), 2026-11-25 Carsamba.
    const { starts } = planSlotStarts(
      SHOP,
      {
        weekly: [{ weekday: 2, isClosed: true, openingTime: "09:00", closingTime: "20:00" }],
        closures: [{ startDate: "2026-11-25", endDate: "2026-11-25" }],
      },
      NOW,
      3,
    );
    expect(new Set(starts.map((d) => d.toISOString().slice(0, 10)))).toEqual(new Set(["2026-11-26"]));
  });

  it("7/24 dukkan gunde 48 slot", () => {
    const { starts } = planSlotStarts({ ...SHOP, open247: true }, undefined, new Date("2026-11-23T21:00:00Z"), 1);
    expect(starts).toHaveLength(48);
  });

  it("gecmis slot planlanmaz", () => {
    // Istanbul 15:00: 09:00-14:30 gecmiste, 15:00-19:30 kalir.
    const { starts } = planSlotStarts(SHOP, undefined, new Date("2026-11-24T12:00:00Z"), 1);
    expect(starts).toHaveLength(10);
    expect(starts[0].toISOString()).toBe("2026-11-24T12:00:00.000Z");
  });
});

describe("generateSlotsForShop", () => {
  it("YALNIZCA o dukkana yazar, tekrari tekil kisita birakir (idempotent)", async () => {
    const r = await generateSlotsForShop("shop-a", { now: NOW, horizonDays: 2 });
    expect(r.created).toBe(44);
    const arg = tx.shopTimeSlot.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(new Set(arg.data.map((d: { shopId: string }) => d.shopId))).toEqual(new Set(["shop-a"]));
    expect(arg.data[0]).toMatchObject({ capacity: 10 });
  });

  it("dukkan basina danisma kilidi alir ve takvimi transaction icinde okur", async () => {
    await generateSlotsForShop("shop-a", { now: NOW, horizonDays: 1 });
    const sql = tx.$executeRaw.mock.calls[0][0].join("?");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(tx.$executeRaw.mock.calls[0][1]).toBe("shop-slots:shop-a");
    expect(tx.shopWeeklyHours.findMany).toHaveBeenCalled();
  });

  it.each([
    ["pasif", { isActive: false }],
    ["test", { isTest: true }],
    ["talep testi", { isPrelaunch: true }],
  ])("%s dukkana slot yazilmaz", async (_n, over) => {
    tx.shop.findUnique.mockResolvedValue({ ...SHOP, ...over });
    const r = await generateSlotsForShop("shop-a", { now: NOW });
    expect(r.skipped).toBe("not_operating");
    expect(tx.shopTimeSlot.createMany).not.toHaveBeenCalled();
  });

  it("olmayan dukkan: hata degil, atlama", async () => {
    tx.shop.findUnique.mockResolvedValue(null);
    expect((await generateSlotsForShop("yok", { now: NOW })).skipped).toBe("not_found");
  });

  it("uzlastirma: rezervasyonlu slota DOKUNMAZ, takvim disi bos slotu pasife alir, kapasiteyi gunceller", async () => {
    // Saat 09:00-20:00 -> plan. Mevcut: 07:00 (takvim disi, bos), 07:30 (takvim disi, REZERVASYONLU),
    // 09:00 (planda, eski kapasite 5), 09:30 (planda, rezervasyonlu, kapasite 5), 10:00 (planda, pasif).
    const at = (iso: string) => new Date(iso);
    tx.$queryRaw.mockResolvedValue([
      { id: "off-free", startTime: at("2026-11-24T04:00:00Z"), capacity: 10, isActive: true },
      { id: "off-booked", startTime: at("2026-11-24T04:30:00Z"), capacity: 10, isActive: true },
      { id: "in-resize", startTime: at("2026-11-24T06:00:00Z"), capacity: 5, isActive: true },
      { id: "in-booked", startTime: at("2026-11-24T06:30:00Z"), capacity: 5, isActive: true },
      { id: "in-inactive", startTime: at("2026-11-24T07:00:00Z"), capacity: 10, isActive: false },
    ]);
    tx.reservationSlot.findMany.mockResolvedValue([{ slotId: "off-booked" }, { slotId: "in-booked" }]);

    const r = await generateSlotsForShop("shop-a", { now: NOW, horizonDays: 1 });
    expect(r).toMatchObject({ deactivated: 1, reactivated: 1, capacityUpdated: 1 });

    const calls = tx.shopTimeSlot.updateMany.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({ where: { id: { in: ["off-free"] } }, data: { isActive: false } });
    expect(calls).toContainEqual({ where: { id: { in: ["in-inactive"] } }, data: { isActive: true, capacity: 10 } });
    expect(calls).toContainEqual({ where: { id: { in: ["in-resize"] } }, data: { capacity: 10 } });
    const touched = calls.flatMap((c) => c.where.id.in);
    expect(touched).not.toContain("off-booked");
    expect(touched).not.toContain("in-booked");

    // Gelecek slotlar kilit altinda okunuyor; ufuk penceresiyle sinirli.
    const sql = tx.$queryRaw.mock.calls[0][0].join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain('"startTime" >= ?');
    expect(sql).toContain('"startTime" < ?');
  });

  it("fill modu (gece isi) mevcut slota dokunmaz", async () => {
    await generateSlotsForShop("shop-a", { now: NOW, horizonDays: 1, mode: "fill" });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.shopTimeSlot.updateMany).not.toHaveBeenCalled();
  });

  it("ikinci cagri yeni satir yazmaz (tekil kisit createMany'de atlatilir)", async () => {
    tx.shopTimeSlot.createMany.mockResolvedValueOnce({ count: 22 }).mockResolvedValueOnce({ count: 0 });
    const first = await generateSlotsForShop("shop-a", { now: NOW, horizonDays: 1 });
    const second = await generateSlotsForShop("shop-a", { now: NOW, horizonDays: 1 });
    expect(first.created).toBe(22);
    expect(second.created).toBe(0);
  });
});

describe("scheduleSlotGeneration", () => {
  it("hata cagirani dusurmez, loglanir", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("db down"));
    expect(() => scheduleSlotGeneration("shop-a", "approve")).not.toThrow();
    await vi.waitFor(() =>
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ shopId: "shop-a", reason: "approve" }),
        "shop_slot_generation_failed",
      ),
    );
  });
});

describe("fillMissingSlots (gece isi)", () => {
  it("bir dukkanin hatasi digerlerini durdurmaz, tur sonunda basarisiz sayilir", async () => {
    mockPrisma.shop.findMany.mockResolvedValue([{ id: "bad" }, { id: "good" }]);
    mockPrisma.$transaction
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce(async (fn: (t: typeof tx) => unknown) => fn(tx));
    await expect(fillMissingSlots()).rejects.toThrow(/1_of_2/);
    expect(tx.shopTimeSlot.createMany).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: "bad" }),
      "generate_slots_shop_failed",
    );
  });

  it("isletilen dukkanlari fill moduyla dolasir", async () => {
    mockPrisma.shop.findMany.mockResolvedValue([{ id: "shop-a" }]);
    const n = await fillMissingSlots();
    expect(n).toBe(tx.shopTimeSlot.createMany.mock.calls[0][0].data.length);
    expect(mockPrisma.shop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, isTest: false, isPrelaunch: false } }),
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
