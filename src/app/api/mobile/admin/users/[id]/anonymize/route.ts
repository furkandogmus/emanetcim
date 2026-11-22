import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { accountPrivacyService, type AdminAnonymizeResult } from "@/services/AccountPrivacyService";

const BodySchema = z.object({ confirm: z.string().max(320), reason: z.string().max(1000) }).strict();

const STATUS: Record<Extract<AdminAnonymizeResult, { ok: false }>["reason"], number> = {
  not_found: 404,
  cannot_delete_self: 409,
  already_anonymized: 409,
  invalid_reason: 400,
  confirm_mismatch: 400,
  not_guest: 409,
  active_bookings: 409,
};

/**
 * Hesabi anonimlestir (KVKK silme). Kendi silmesiyle ayni govde:
 * `AccountPrivacyService.anonymizeByAdmin`; onay metni ve gerekce orada dogrulanir.
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
  const result = await accountPrivacyService.anonymizeByAdmin({
    targetUserId: id,
    actor: { userId: auth.user.id, ip: clientIpFromRequest(req) },
    confirm: parsed.data.confirm,
    reason: parsed.data.reason,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] });
  return NextResponse.json({ ok: true });
}
