import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminDispute } from "@/lib/mobile-dto";
import { disputeService } from "@/services/DisputeService";

/** GET `?status=OPEN|IN_REVIEW|RESOLVED|CLOSED` (taninmayan = hepsi). Web `/admin/disputes` ile ayni sorgu. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  const rows = await disputeService.listForAdmin(req.nextUrl.searchParams.get("status"));
  return NextResponse.json({ items: rows.map(toMobileAdminDispute) });
}
