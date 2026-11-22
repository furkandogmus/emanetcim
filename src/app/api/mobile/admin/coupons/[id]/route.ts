import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { adminSetCouponActive } from "@/services/CouponService";

/** PATCH `{ isActive }`. Silme ve duzenleme yok: web de yalniz acip kapatiyor. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  const { id } = await params;
  const { isActive } = await readOpsBody(req);
  const result = await adminSetCouponActive(auth.user, id, isActive, { ip: clientIp(req) });
  if (!result.ok) return opsError(result.reason);
  return NextResponse.json({ success: true });
}
