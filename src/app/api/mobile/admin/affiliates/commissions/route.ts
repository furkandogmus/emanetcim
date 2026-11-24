import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { unpaidCommissionsCsv } from "@/services/AffiliateService";

/**
 * Odenmemis araci komisyonlari CSV'si (web `/api/admin/affiliates/commissions` ile ayni
 * govde). Mobil dosya indirmez: metin JSON'da doner, uygulama paylasim menusune verir.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const month = req.nextUrl.searchParams.get("month") || undefined;
  if (month && !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const csv = await unpaidCommissionsCsv({ month });
  return NextResponse.json(
    { csv, filename: `araci-komisyon-${month ?? "tum"}.csv` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
