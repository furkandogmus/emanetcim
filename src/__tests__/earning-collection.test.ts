/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { collectedAt, collectedEarningsWhere } from "@/lib/earning-collection";

/**
 * ESNAF KAZANCI TESLIM ANINA GORE (urun karari, 2026-11).
 *
 * Panel "bu ay" olusturma tarihine, mobil "bugun" check-in'e, gecmis listesi
 * yine olusturmaya bakiyordu: ayin 30'unda yapilip 1'inde teslim edilen emanet
 * gecen aya yaziliyor, kasa uygulamayla tutmuyordu. Artik uc yuzey tek
 * yardimciyi kullanir.
 */

const { mockPrisma, mockRequireMobileUser } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    shop: { findMany: vi.fn() },
  },
  mockRequireMobileUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/lib/commission", () => ({
  getEffectiveCommission: vi.fn().mockResolvedValue({ rate: 0, merchantShareRatio: 1 }),
}));

import { partnerDashboardService } from "@/services/PartnerDashboardService";
import { GET as earningsGET } from "@/app/api/mobile/partner/earnings/stats/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.booking.count.mockResolvedValue(0);
  mockPrisma.booking.aggregate.mockResolvedValue({
    _sum: { totalPrice: 0, bagCountS: 0, bagCountM: 0, bagCountXl: 0 },
  });
  mockPrisma.booking.findMany.mockResolvedValue([]);
});

describe("collectedEarningsWhere", () => {
  it("yalnizca teslim edilenleri, teslim anina gore suzer", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const end = new Date("2026-12-01T00:00:00Z");
    expect(collectedEarningsWhere({ start, end })).toEqual({
      status: "CHECKED_OUT",
      OR: [
        { checkedOutAt: { gte: start, lt: end } },
        // `checkedOutAt` oncesi eski satirlar planlanan cikisa duser.
        { checkedOutAt: null, checkOutTime: { gte: start, lt: end } },
      ],
    });
  });

  it("aralik yoksa tum teslim edilenler", () => {
    expect(collectedEarningsWhere()).toEqual({ status: "CHECKED_OUT" });
  });

  it("collectedAt gerceklesen teslimi tercih eder", () => {
    const planned = new Date("2026-11-02T10:00:00Z");
    const actual = new Date("2026-11-02T12:30:00Z");
    expect(collectedAt({ checkedOutAt: actual, checkOutTime: planned })).toBe(actual);
    expect(collectedAt({ checkedOutAt: null, checkOutTime: planned })).toBe(planned);
  });
});

describe("panel 'bu ay kazancin'", () => {
  it("olusturma tarihine degil teslim anina bakar", async () => {
    // Istanbul'da 1 Aralik sabahi: ay basi 30 Kasim 21:00 UTC.
    await partnerDashboardService.getSnapshot("s1", "Europe/Istanbul", 0, new Date("2026-12-01T07:00:00Z"));
    const moneyWheres = mockPrisma.booking.aggregate.mock.calls
      .map((c: any[]) => c[0])
      .filter((a: any) => a._sum.totalPrice)
      .map((a: any) => a.where);
    expect(moneyWheres).toHaveLength(2);
    for (const w of moneyWheres) {
      expect(w.status).toBe("CHECKED_OUT");
      expect(w.createdAt).toBeUndefined();
    }
    expect(moneyWheres[0].OR[0].checkedOutAt.gte).toEqual(new Date("2026-11-30T21:00:00Z"));
  });
});

describe("mobil kazanc ekrani", () => {
  beforeEach(() => {
    mockRequireMobileUser.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
    mockPrisma.shop.findMany.mockResolvedValue([{ id: "s1", timezone: "Europe/Istanbul" }]);
  });

  it("toplam, bugun ve gecmis ayni teslim tabanindan; satir misafir ve rezervasyon tasir", async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "b1",
        shopId: "s1",
        totalPrice: 150,
        checkedOutAt: new Date("2026-11-21T15:00:00Z"),
        checkOutTime: new Date("2026-11-21T18:00:00Z"),
        guest: { name: "Misafir" },
      },
    ]);
    const res = (await earningsGET(new NextRequest("https://x/api/mobile/partner/earnings/stats")))!;
    expect(res.status).toBe(200);

    const [total, today] = mockPrisma.booking.aggregate.mock.calls.map((c: any[]) => c[0].where);
    expect(total.status).toBe("CHECKED_OUT");
    expect(today.status).toBe("CHECKED_OUT");
    expect(today.checkedInAt).toBeUndefined();
    expect(today.OR[0].checkedOutAt.gte).toBeInstanceOf(Date);
    expect(mockPrisma.booking.findMany.mock.calls[0][0].where.status).toBe("CHECKED_OUT");

    const body = await res.json();
    expect(body.history[0]).toMatchObject({
      bookingId: "b1",
      guestName: "Misafir",
      collectedAt: "2026-11-21T15:00:00.000Z",
      // 0.3.x istemcileri satir saatini `createdAt`ten okur: teslim ani olmali.
      createdAt: "2026-11-21T15:00:00.000Z",
      amount: 150,
    });
  });
});
