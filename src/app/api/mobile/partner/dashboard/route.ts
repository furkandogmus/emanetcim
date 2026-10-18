import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { getEffectiveCommission } from "@/lib/commission";
import { resolvePartnerShops } from "@/lib/partner-shop";
import { toMobilePartnerDashboard } from "@/lib/mobile-dto";
import { partnerDashboardService } from "@/services/PartnerDashboardService";

/**
 * Esnafin gunluk dukkan ozeti (bugun gelecek / alinacak, elde duran valiz,
 * aylik kazanc). Web `/partner` sayfasiyla AYNI dukkan secimi
 * (`resolvePartnerShops`, `?shop=`) ve AYNI servis; sayim kurali burada yazilmaz.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const { shops, activeShop } = await resolvePartnerShops(auth.user.id, req.nextUrl.searchParams.get("shop"));
  if (!activeShop) return NextResponse.json({ error: "no_shops" }, { status: 404 });

  const [shop, commission] = await Promise.all([
    prisma.shop.findUnique({ where: { id: activeShop.id }, select: { timezone: true } }),
    getEffectiveCommission(),
  ]);

  const snapshot = await partnerDashboardService.getSnapshot(
    activeShop.id,
    shop?.timezone,
    commission.rate,
  );
  return NextResponse.json(toMobilePartnerDashboard(snapshot, activeShop, shops));
}
