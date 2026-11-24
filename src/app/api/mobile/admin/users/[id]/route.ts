import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminUserDetail } from "@/lib/mobile-dto";
import { adminUserService, type DeleteUserResult } from "@/services/AdminUserService";

/** Tek istekte tek bayrak: ikisinin kurali ve denetim kaydi ayri. */
const PatchSchema = z.union([
  z.object({ isBanned: z.boolean() }).strict(),
  z.object({ reviewSandbox: z.boolean() }).strict(),
]);

/** Kullanici detayi: islem bolumu dogrulama/sifre/bekleyen rol durumuna gore acilir. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const user = await adminUserService.getDetail(id);
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ user: toMobileAdminUserDetail(user) });
}

/**
 * Yasakla / yasagi kaldir (`AdminUserService.setBanned`: token iptali, denetim kaydi)
 * ya da inceleme (App Review) hesabi yap / geri al (`setReviewSandbox`).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const { id } = await params;
  const actor = { userId: auth.user.id, ip: clientIpFromRequest(req) };
  const result =
    "reviewSandbox" in parsed.data
      ? await adminUserService.setReviewSandbox(id, parsed.data.reviewSandbox, actor)
      : await adminUserService.setBanned(id, parsed.data.isBanned, actor);
  if (!result.ok) {
    return result.error === "not_found"
      ? NextResponse.json({ error: "not_found" }, { status: 404 })
      : NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

const DeleteSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

const DELETE_STATUS: Record<Extract<DeleteUserResult, { ok: false }>["error"], number> = {
  cannot_delete_self: 409,
  has_active_booking: 409,
  blocked_by_relations: 409,
};

/**
 * Kullaniciyi kalici sil (web "sil" ile ayni govde: `AdminUserService.deleteUser`).
 * Gerekce zorunlu ve denetim kaydina yazilir. KVKK talebi icin `anonymize` ucu var.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const { id } = await params;
  const result = await adminUserService.deleteUser(id, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
    reason: parsed.data.reason,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: DELETE_STATUS[result.error] });
  return NextResponse.json({ ok: true });
}
