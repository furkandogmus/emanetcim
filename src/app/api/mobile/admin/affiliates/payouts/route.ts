import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { adminMarkCommissionsPaid } from "@/services/AffiliateService";

/** POST `{ month: "2026-11", reference, affiliateId? }` -> `{ count, total }`. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { month, reference, affiliateId } = await readOpsBody(req);
  const result = await adminMarkCommissionsPaid(
    auth.user,
    { month, reference, ...(affiliateId ? { affiliateId } : {}) },
    { ip: clientIp(req) },
  );
  if (!result.ok) return opsError(result.reason);
  return NextResponse.json({ count: result.count, total: result.total });
}
