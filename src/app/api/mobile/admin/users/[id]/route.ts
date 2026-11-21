import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminUserService } from "@/services/AdminUserService";

const PatchSchema = z.object({ isBanned: z.boolean() }).strict();

/** Yasakla / yasagi kaldir; kural (token iptali, denetim kaydi) `AdminUserService.setBanned`ta. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const { id } = await params;
  const result = await adminUserService.setBanned(id, parsed.data.isBanned, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  });
  if (!result.ok) {
    return result.error === "not_found"
      ? NextResponse.json({ error: "not_found" }, { status: 404 })
      : NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
