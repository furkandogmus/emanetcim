import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { count: vi.fn(), aggregate: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { partnerDashboardService } from "@/services/PartnerDashboardService";

/** `aggregate` cagrilari SIRAYLA doner: depodaki, bu ay, gecen ay, teslim edilen. */
function stubAggregates(opts: {
  inStorageBags?: number;
  monthGross?: number;
  prevMonthGross?: number;
  handledBags?: number;
}) {
  const bags = (n: number) => ({
    _sum: { bagCountS: n, bagCountM: 0, bagCountXl: 0 },
  });
  const money = (n: number) => ({ _sum: { totalPrice: n } });
  mockPrisma.booking.aggregate
    .mockResolvedValueOnce(bags(opts.inStorageBags ?? 0))
    .mockResolvedValueOnce(money(opts.monthGross ?? 0))
    .mockResolvedValueOnce(money(opts.prevMonthGross ?? 0))
    .mockResolvedValueOnce(bags(opts.handledBags ?? 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.booking.count.mockResolvedValue(0);
});

describe("panel enstantanesi", () => {
  it("geçen ay SIFIRSA yüzde değişim göstermez", async () => {
    /*
      Sifira bolmek "%sonsuz artis" gibi anlamsiz bir rakam uretir. Yeni acilan
      bir dukkan da her ay "%100 artis" gormemeli -- gostergenin anlami kalmaz.
    */
    stubAggregates({ monthGross: 500, prevMonthGross: 0 });
    const s = await partnerDashboardService.getSnapshot("s1", "Europe/Istanbul", 0);
    expect(s.monthChangePct).toBeNull();
    expect(s.monthNet).toBe(500);
  });

  it("artışı ve düşüşü yüzde olarak verir", async () => {
    stubAggregates({ monthGross: 1230, prevMonthGross: 1000 });
    expect(
      (await partnerDashboardService.getSnapshot("s1", "Europe/Istanbul", 0)).monthChangePct,
    ).toBe(23);

    vi.clearAllMocks();
    mockPrisma.booking.count.mockResolvedValue(0);
    stubAggregates({ monthGross: 400, prevMonthGross: 1000 });
    expect(
      (await partnerDashboardService.getSnapshot("s1", "Europe/Istanbul", 0)).monthChangePct,
    ).toBe(-60);
  });

  it("komisyon yürürlükteyse aylık tutarlar esnaf payıdır", async () => {
    stubAggregates({ monthGross: 1000, prevMonthGross: 2000 });
    const s = await partnerDashboardService.getSnapshot("s1", "Europe/Istanbul", 0.2);
    expect(s.monthNet).toBe(800);
    expect(s.prevMonthNet).toBe(1600);
    // Oran her iki tarafa da uygulandigi icin YUZDE DEGISIM ayni kalir.
    expect(s.monthChangePct).toBe(-50);
  });

  it("üç boydaki valizleri tek sayıda toplar", async () => {
    mockPrisma.booking.aggregate
      .mockResolvedValueOnce({ _sum: { bagCountS: 2, bagCountM: 3, bagCountXl: 1 } })
      .mockResolvedValueOnce({ _sum: { totalPrice: 0 } })
      .mockResolvedValueOnce({ _sum: { totalPrice: 0 } })
      .mockResolvedValueOnce({ _sum: { bagCountS: 10, bagCountM: null, bagCountXl: 5 } });
    const s = await partnerDashboardService.getSnapshot("s1", "Europe/Istanbul", 0);
    expect(s.bagsInStorage).toBe(6);
    // `null` toplam (hic kayit yoksa Prisma null doner) 0 sayilmali.
    expect(s.bagsHandledAllTime).toBe(15);
  });

  it("bozuk saat dilimi sorguyu düşürmez", async () => {
    stubAggregates({});
    await expect(
      partnerDashboardService.getSnapshot("s1", "bozuk/zaman'; DROP", 0),
    ).resolves.toBeDefined();
  });
});
