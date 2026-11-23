import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminRoleChangeRequest } from "@/lib/mobile-dto";
import { adminUserService } from "@/services/AdminUserService";

export const dynamic = "force-dynamic";

/** Mobil admin: ikinci onay bekleyen rol degisiklikleri (web `/admin/role-approvals` ile ayni liste). */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const rows = await adminUserService.listRoleChangeRequests();
  return NextResponse.json(rows.map((r) => toMobileAdminRoleChangeRequest(r, auth.user.id)));
}
