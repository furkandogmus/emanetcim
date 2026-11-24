import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminPartnerCreateService, type AdminGuestConvertFailure } from "@/services/AdminPartnerCreateService";

const STATUS: Record<AdminGuestConvertFailure, number> = {
  invalid_data: 400,
  location_required: 400,
  invalid_tr_phone: 400,
  phone_already_registered: 409,
  not_found: 404,
  not_guest: 409,
};

/**
 * Misafiri esnafa cevir: web action'i ve mobil `admin/partners` (`fromUserId`) ile
 * ayni govde, `AdminPartnerCreateService.convertGuest`. Hedef yoldan gelir, govdedeki
 * `userId` yok sayilir.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const body = await req.json().catch(() => null);
  const { id } = await params;
  const result = await adminPartnerCreateService.convertGuest(
    { id: auth.user.id, role: auth.user.role },
    body && typeof body === "object" ? { ...body, userId: id } : null,
    { ip: clientIpFromRequest(req) },
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] });
  return NextResponse.json({ ok: true, shopId: result.shopId, phone: result.phone, resetUrl: result.resetUrl });
}
