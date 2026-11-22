import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminUserService, type ChangeRoleResult } from "@/services/AdminUserService";

const BodySchema = z.object({ role: z.enum(["GUEST", "PARTNER", "ADMIN"]) }).strict();

const STATUS: Record<Extract<ChangeRoleResult, { ok: false }>["error"], number> = {
  not_found: 404,
  cannot_change_self: 409,
  same_role: 409,
  pending_exists: 409,
  cannot_demote_sole_admin: 409,
};

/**
 * Rol degistir. Kural (kendi rolu, son admin, ikinci admin onayi, token iptali,
 * denetim kaydi) `AdminUserService.changeRole`ta; web action'i da onu cagirir.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const { id } = await params;
  const result = await adminUserService.changeRole(id, parsed.data.role, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });
  return NextResponse.json({ ok: true, status: result.status });
}
