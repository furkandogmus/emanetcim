import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminUserService, type BlockIpResult } from "@/services/AdminUserService";

const BodySchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

const STATUS: Record<Extract<BlockIpResult, { ok: false }>["error"], number> = {
  not_found: 404,
  no_ip: 409,
  invalid_ip: 409,
  own_ip: 409,
};

/**
 * Kullanicinin son giris IP'sini engelle (web "IP engelle" ile ayni govde:
 * `AdminUserService.blockUserIp`). IP govdede gelmez, kayittan okunur.
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
  const result = await adminUserService.blockUserIp(id, parsed.data.reason, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });
  return NextResponse.json({ ok: true, ip: result.ip });
}
