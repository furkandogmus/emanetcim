import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminAnalytics } from "@/lib/mobile-dto";
import { bookingSourceService } from "@/services/BookingSourceService";
import { analyticsService } from "@/services/AnalyticsService";

/** Ekranin sundugu araliklar; baska deger 30'a duser (web sabit 30 gun). */
const ANALYTICS_RANGES = [7, 30, 90] as const;

function parseDays(raw: string | null): number {
  const n = Number(raw);
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? n : 30;
}

/** Birinci taraf analitik ozeti (salt okuma). `?days=7|30|90`. Sorgu web ile ortak. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const days = parseDays(req.nextUrl.searchParams.get("days"));
  const [summary, sources] = await Promise.all([
    analyticsService.getDashboardSummary(days),
    bookingSourceService.breakdown(days),
  ]);
  return NextResponse.json(toMobileAdminAnalytics(summary, sources));
}
