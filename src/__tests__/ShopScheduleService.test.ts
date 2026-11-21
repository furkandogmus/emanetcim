import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockPrisma: {
    booking: { findMany: vi.fn() },
    shop: { findUnique: vi.fn(), update: vi.fn() },
    shopClosure: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    shopWeeklyHours: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

vi.mock("@/services/SlotService", () => ({ generateSlotsForShop: mockGenerate }));

import { addClosure, findScheduleConflicts, removeClosure, saveWeeklyHours } from "@/services/ShopScheduleService";

const NOW = new Date("2026-10-05T08:00:00Z");
const booking = (status: string, inIso: string, outIso: string) => ({
  id: `b-${status}-${inIso}`,
  status,
  guestEmail: "g@example.com",
  guest: null,
  checkInTime: new Date(inIso),
  checkOutTime: new Date(outIso),
});

describe("findScheduleConflicts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("izin gunune denk gelen birakis ve alis cakisma sayilir", async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      booking("PAID", "2026-10-12T06:00:00Z", "2026-10-13T17:00:00Z"),
    ]);
    const c = await findScheduleConflicts(
      "s1",
      { closures: [{ startDate: "2026-10-12", endDate: "2026-10-13" }] },
      NOW,
    );
    expect(c.map((x) => x.kind)).toEqual(["dropoff", "pickup"]);
  });

  it("rafta valizi olan dukkan izin araligi boyunca kapanamaz", async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      booking("CHECKED_IN", "2026-10-04T06:00:00Z", "2026-10-20T17:00:00Z"),
    ]);
    const c = await findScheduleConflicts(
      "s1",
      { closures: [{ startDate: "2026-10-10", endDate: "2026-10-11" }] },
      NOW,
    );
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("bags_on_shelf");
  });

  it("rezervasyon izin disinda kaliyorsa cakisma yok", async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      booking("PAID", "2026-10-07T06:00:00Z", "2026-10-08T17:00:00Z"),
    ]);
    const c = await findScheduleConflicts(
      "s1",
      { closures: [{ startDate: "2026-10-12", endDate: "2026-10-13" }] },
      NOW,
    );
    expect(c).toEqual([]);
  });
});

describe("addClosure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cakisma varsa yazmaz", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({
      open247: false, openingTime: "09:00", closingTime: "20:00", timezone: "Europe/Istanbul",
    });
    mockPrisma.shopWeeklyHours.findMany.mockResolvedValue([]);
    mockPrisma.shopClosure.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([
      booking("PAID", "2026-10-12T06:00:00Z", "2026-10-12T17:00:00Z"),
    ]);
    const r = await addClosure("s1", { startDate: "2026-10-12", endDate: "2026-10-12" }, NOW);
    expect(r).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(mockPrisma.shopClosure.create).not.toHaveBeenCalled();
  });

  it("gecmis tarihli ya da ters aralik reddedilir", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({
      open247: false, openingTime: "09:00", closingTime: "20:00", timezone: "Europe/Istanbul",
    });
    mockPrisma.shopWeeklyHours.findMany.mockResolvedValue([]);
    mockPrisma.shopClosure.findMany.mockResolvedValue([]);
    expect(await addClosure("s1", { startDate: "2026-10-01", endDate: "2026-10-02" }, NOW)).toEqual({ ok: false, code: "INVALID" });
    expect(await addClosure("s1", { startDate: "2026-10-09", endDate: "2026-10-08" }, NOW)).toEqual({ ok: false, code: "INVALID" });
  });
});

describe("takvim degisince slot uretimi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue(0);
  });

  it("removeClosure slotlari yeniden uretir; uretim hatasi yutulur", async () => {
    mockPrisma.shopClosure.deleteMany.mockResolvedValue({ count: 1 });
    mockGenerate.mockRejectedValue(new Error("db"));
    await expect(removeClosure("s1", "c1")).resolves.toBeUndefined();
    expect(mockGenerate).toHaveBeenCalledWith("s1");
  });

  it("gecersiz haftalik saat slot uretmez", async () => {
    await saveWeeklyHours("s1", [], false);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
