import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminCoupon } from "@/lib/mobile-dto";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { adminCreateCoupon, listCouponsForAdmin } from "@/services/CouponService";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const rows = await listCouponsForAdmin();
  return NextResponse.json({ items: rows.map(toMobileAdminCoupon) });
}

/** POST -> 201 `{ id, code }`. Sema ve denetim kaydi `adminCreateCoupon`da (web ile ayni). */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { code, discount, isPercent, minPrice, maxUses, expiresAt } = await readOpsBody(req);
  const result = await adminCreateCoupon(
    auth.user,
    { code, discount, isPercent, minPrice, maxUses, expiresAt },
    { ip: clientIp(req) },
  );
  if (!result.ok) return opsError(result.reason);
  return NextResponse.json({ id: result.id, code: result.code }, { status: 201 });
}
