import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { accountPrivacyService } from "@/services/AccountPrivacyService";

const BodySchema = z.object({ reason: z.string().max(1000).optional() });

const STATUS: Record<string, number> = {
  not_found: 404,
  not_pending: 409,
  cannot_delete_self: 409,
  active_bookings: 409,
  pending_payouts: 409,
  invalid_reason: 400,
};

/** `complete` (anonimlestir) | `cancel` (gerekceyle; dukkanlar geri acilir). Web action'lariyla ayni servis. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id, action } = await params;
  if (action !== "complete" && action !== "cancel") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = BodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const actor = { userId: auth.user.id, ip: clientIpFromRequest(req) };
  const result =
    action === "complete"
      ? await accountPrivacyService.completeDeletionRequest({ requestId: id, actor })
      : await accountPrivacyService.cancelDeletionRequest({ requestId: id, reason: parsed.data.reason ?? "", actor });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] ?? 400 });
  return NextResponse.json({ ok: true });
}
