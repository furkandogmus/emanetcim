import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { toMobileAdminOverview } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminOverviewService } from "@/services/AdminOverviewService";
import { mobileInstallService } from "@/services/MobileInstallService";
import { withCancelReasons } from "@/services/booking/cancel-reason";

/**
 * Mobil yonetim ana ekrani: bugun, 14 gunluk seri, dikkat isteyenler ve son
 * rezervasyonlar tek istekte. `admin/stats` eski derlemeler icin oldugu gibi kalir.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const [overview, appUsers] = await Promise.all([
    adminOverviewService.overview(),
    mobileInstallService.activeCounts(),
  ]);
  const recent = await withCancelReasons(overview.recent);
  return NextResponse.json(toMobileAdminOverview({ ...overview, recent }, appUsers));
}
