import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminAffiliate } from "@/lib/mobile-dto";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { adminCreateAffiliate, listAffiliatesForAdmin } from "@/services/AffiliateService";

/** Araci listesi (sayaclarla). Web `/admin/affiliates` ile ayni servis ve DTO. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const rows = await listAffiliatesForAdmin();
  return NextResponse.json({ items: rows.map(toMobileAdminAffiliate) });
}

/** POST -> 201 `{ id, code }`. Sema ve denetim kaydi `adminCreateAffiliate`da. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const result = await adminCreateAffiliate(auth.user, await readOpsBody(req), { ip: clientIp(req) });
  if (!result.ok) return opsError(result.reason);
  return NextResponse.json({ id: result.id, code: result.code }, { status: 201 });
}
