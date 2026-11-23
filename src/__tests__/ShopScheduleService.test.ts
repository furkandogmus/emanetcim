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

vi.mock("@/services/SlotService", () => ({ scheduleSlotGeneration: mockGenerate }));
const mockAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAudit }));

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

describe("findScheduleConflicts saat daraltma (bulgu 67)", () => {
  beforeEach(() => vi.clearAllMocks());
  const days = (close: string) =>
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, isClosed: false, openingTime: "09:00", closingTime: close }));
  const tz = "Europe/Istanbul";

  it("kapanisi one ceken degisiklik o saatteki birakisi ve alisi cakisma sayar", async () => {
    // 17:00Z = 20:00 Istanbul birakis, ertesi gun 18:00Z = 21:00 alis.
    mockPrisma.booking.findMany.mockResolvedValue([
      booking("APPROVED", "2026-10-07T17:00:00Z", "2026-10-08T18:00:00Z"),
    ]);
    const c = await findScheduleConflicts("s1", { timeZone: tz, weekly: days("18:00") }, NOW, {
      current: { timeZone: tz, weekly: days("22:00") },
    });
    expect(c.map((x) => [x.kind, x.date])).toEqual([
      ["dropoff", "2026-10-07"],
      ["pickup", "2026-10-08"],
    ]);
  });

  it("tolerans icindeki an cakisma sayilmaz", async () => {
    // 15:10Z = 18:10 Istanbul; kapanis 18:00 + 15 dk tolerans.
    mockPrisma.booking.findMany.mockResolvedValue([
      booking("APPROVED", "2026-10-07T15:10:00Z", "2026-10-07T15:10:00Z"),
    ]);
    const c = await findScheduleConflicts("s1", { timeZone: tz, weekly: days("18:00") }, NOW, {
      current: { timeZone: tz, weekly: days("22:00") },
      graceMinutes: 15,
    });
    expect(c).toEqual([]);
  });

  it("bugunku takvimde de saat disinda kalan eski kayit ilgisiz duzenlemeyi kilitlemez", async () => {
    // 20:30 Istanbul: hem eski (20:00) hem yeni (19:00) takvimde kapali.
    mockPrisma.booking.findMany.mockResolvedValue([
      booking("APPROVED", "2026-10-07T17:30:00Z", "2026-10-07T17:30:00Z"),
    ]);
    const c = await findScheduleConflicts("s1", { timeZone: tz, weekly: days("19:00") }, NOW, {
      current: { timeZone: tz, weekly: days("20:00") },
    });
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

  it("removeClosure slotlari yeniden uretir", async () => {
    mockPrisma.shopClosure.deleteMany.mockResolvedValue({ count: 1 });
    await expect(removeClosure("s1", "c1")).resolves.toBeUndefined();
    expect(mockGenerate).toHaveBeenCalledWith("s1", "closure_remove");
  });

  it("addClosure izin gunlerinin slotlarini uzlastirir", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({
      open247: false, openingTime: "09:00", closingTime: "20:00", timezone: "Europe/Istanbul",
    });
    mockPrisma.shopWeeklyHours.findMany.mockResolvedValue([]);
    mockPrisma.shopClosure.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.shopClosure.create.mockResolvedValue({ id: "c2" });
    expect(await addClosure("s1", { startDate: "2026-10-12", endDate: "2026-10-12" }, NOW)).toEqual({ ok: true });
    expect(mockGenerate).toHaveBeenCalledWith("s1", "closure_add");
  });

  it("gecersiz haftalik saat slot uretmez", async () => {
    await saveWeeklyHours("s1", [], false);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe("yonetici duzenlemesi denetim kaydi birakir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue(0);
    mockPrisma.shop.findUnique.mockResolvedValue({
      open247: false, openingTime: "09:00", closingTime: "20:00", timezone: "Europe/Istanbul",
    });
    mockPrisma.shopWeeklyHours.findMany.mockResolvedValue([]);
    mockPrisma.shopClosure.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.shopClosure.create.mockResolvedValue({ id: "c9" });
    mockPrisma.shopClosure.deleteMany.mockResolvedValue({ count: 1 });
  });
  const ADMIN = { id: "admin-1", role: "ADMIN", ip: "198.51.100.2" };

  it("izin ekleme ve kaldirma ADMIN'de kaydedilir, esnafta kaydedilmez", async () => {
    expect(await addClosure("s1", { startDate: "2026-10-12", endDate: "2026-10-12" }, NOW, ADMIN)).toEqual({ ok: true });
    await removeClosure("s1", "c9", ADMIN);
    expect(mockAudit.mock.calls.map((c) => c[0].action)).toEqual(["admin.shop.closure_add", "admin.shop.closure_remove"]);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "admin-1", entityId: "s1", ip: "198.51.100.2" }));

    mockAudit.mockClear();
    await addClosure("s1", { startDate: "2026-10-12", endDate: "2026-10-12" }, NOW, { id: "p1", role: "PARTNER" });
    await removeClosure("s1", "c9", { id: "p1", role: "PARTNER" });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("olmayan izni kaldirmak kayit birakmaz", async () => {
    mockPrisma.shopClosure.deleteMany.mockResolvedValue({ count: 0 });
    await removeClosure("s1", "yok", ADMIN);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
