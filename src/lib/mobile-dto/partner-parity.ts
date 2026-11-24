import type { PartnerEarningsInsights } from "@/services/PartnerEarningsService";

/** `GET partner/poster`: tarayicida acilacak oturumsuz afis bagi. */
export function toMobilePosterLink(url: string, expiresAt: Date) {
  return { url, expiresAt: expiresAt.toISOString() };
}

/** `partner/earnings/stats` icindeki `insights` (mobil kazanc grafikleri). */
export function toMobilePartnerInsights(i: PartnerEarningsInsights) {
  return {
    months: i.months.map((m) => ({ month: m.month, net: m.net, count: m.count })),
    peakHours: i.peakHours.map((h) => ({ hour: h.hour, count: h.count })),
    avgStayHours: i.avgStayHours,
    conversionPct: i.conversionPct,
    avgRating: i.avgRating,
  };
}
