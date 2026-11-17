import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminOpsService } from "@/services/AdminOpsService";

/** Suzgec ciplerinin adetleri; liste isteginden ayri onbelleklenir. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  return NextResponse.json(await adminOpsService.bookingCounts());
}
