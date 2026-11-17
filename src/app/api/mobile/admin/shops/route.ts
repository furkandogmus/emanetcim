import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { toMobileAdminShop } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminOpsService } from "@/services/AdminOpsService";

/** Aktif dukkanlar, su an icerideki valizle doluluk sirasina gore. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const shops = await adminOpsService.shopsOccupancy();
  return NextResponse.json({ shops: shops.map(toMobileAdminShop) });
}
