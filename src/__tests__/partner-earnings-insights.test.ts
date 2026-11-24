import { describe, it, expect } from "vitest";
import {
  mergeEarningsInsights,
  recentMonthKeys,
  type PartnerEarningsSummary,
} from "@/services/PartnerEarningsService";

function summary(over: Partial<PartnerEarningsSummary> = {}): PartnerEarningsSummary {
  return {
    totalGross: 0,
    totalNet: 0,
    totalCommission: 0,
    earningBookingCount: 0,
    allBookingCount: 0,
    monthly: [],
    peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, count: 0 })),
    avgStayHours: 0,
    ...over,
  };
}

describe("recentMonthKeys", () => {
  it("dukkanin saat diliminde ay siniri: UTC 31 Ekim 22:00 Istanbul'da Kasim", () => {
    const keys = recentMonthKeys(new Date("2026-10-31T22:00:00Z"), "Europe/Istanbul", 3);
    expect(keys).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("yil devri", () => {
    expect(recentMonthKeys(new Date("2026-02-10T10:00:00Z"), "Europe/Istanbul", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("bozuk saat dilimi varsayilana duser", () => {
    expect(recentMonthKeys(new Date("2026-11-24T10:00:00Z"), "bozuk", 1)).toEqual(["2026-11"]);
  });
});

describe("mergeEarningsInsights", () => {
  const months = ["2026-10", "2026-11"];

  it("tek dukkanda sayilar ozetle birebir; verisiz ay 0", () => {
    const s = summary({
      earningBookingCount: 3,
      allBookingCount: 4,
      avgStayHours: 5,
      monthly: [{ month: "2026-11", grossTotal: 300, netTotal: 270, commissionTotal: 30, count: 3 }],
    });
    s.peakHours[9].count = 2;
    const out = mergeEarningsInsights([{ summary: s, rating: 4.6 }], months);
    expect(out.months).toEqual([
      { month: "2026-10", net: 0, count: 0 },
      { month: "2026-11", net: 270, count: 3 },
    ]);
    expect(out.peakHours[9]).toEqual({ hour: "09:00", count: 2 });
    expect(out.avgStayHours).toBe(5);
    expect(out.conversionPct).toBe(75);
    expect(out.avgRating).toBe(4.6);
  });

  it("cok dukkan: aylar ve saatler toplanir, kalis teslim adediyle agirliklanir", () => {
    const a = summary({
      earningBookingCount: 1,
      allBookingCount: 2,
      avgStayHours: 2,
      monthly: [{ month: "2026-11", grossTotal: 100, netTotal: 100, commissionTotal: 0, count: 1 }],
    });
    const b = summary({
      earningBookingCount: 3,
      allBookingCount: 6,
      avgStayHours: 6,
      monthly: [{ month: "2026-11", grossTotal: 50.1, netTotal: 50.1, commissionTotal: 0, count: 3 }],
    });
    const out = mergeEarningsInsights(
      [
        { summary: a, rating: 0 },
        { summary: b, rating: 4 },
      ],
      months,
    );
    expect(out.months[1]).toEqual({ month: "2026-11", net: 150.1, count: 4 });
    expect(out.avgStayHours).toBe(5);
    expect(out.conversionPct).toBe(50);
    // Puansiz dukkan (0) ortalamayi asagi cekmez.
    expect(out.avgRating).toBe(4);
  });

  it("hic rezervasyon ve puan yoksa sifir ve null; pencere disindaki ay dusmez ama gosterilmez", () => {
    const out = mergeEarningsInsights(
      [{ summary: summary({ monthly: [{ month: "2025-01", grossTotal: 9, netTotal: 9, commissionTotal: 0, count: 1 }] }), rating: null }],
      months,
    );
    expect(out.months.map((m) => m.net)).toEqual([0, 0]);
    expect(out.conversionPct).toBe(0);
    expect(out.avgRating).toBeNull();
  });
});
