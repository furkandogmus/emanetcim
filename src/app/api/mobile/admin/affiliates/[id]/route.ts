import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { adminUpdateAffiliate } from "@/services/AffiliateService";

/** PATCH: tam form (duzenleme ve onay). Oran/durum degisikligi denetim kaydi birakir. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { id } = await params;
  const result = await adminUpdateAffiliate(auth.user, id, await readOpsBody(req), { ip: clientIp(req) });
  if (!result.ok) return opsError(result.reason);
  return NextResponse.json({ success: true });
}
