import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import logger from "@/lib/logger";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { adminUserService, type CancelRoleChangeResult } from "@/services/AdminUserService";

const STATUS: Record<Extract<CancelRoleChangeResult, { ok: false }>["error"], number> = {
  not_found: 404,
  unauthorized: 401,
};

/** Rol degisikligi istegini reddet (web "Iptal" ile ayni): `AdminUserService.cancelRoleChange`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const result = await adminUserService.cancelRoleChange(id, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });

  try {
    revalidatePathAllLocales("/admin/role-approvals");
    revalidatePathAllLocales("/admin/users");
    revalidatePathAllLocales("/admin");
  } catch (err) {
    logger.error({ requestId: id, err }, "revalidate_after_role_reject_failed");
  }
  return NextResponse.json({ ok: true });
}
