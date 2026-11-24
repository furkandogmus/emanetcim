import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import {
  IMPERSONATION_TTL_SECONDS,
  forbidWhileImpersonating,
  requireMobileUser,
  requireRole,
  signImpersonationToken,
} from "@/lib/mobile-auth";
import { toMobileUser } from "@/lib/mobile-dto";
import { adminUserService } from "@/services/AdminUserService";

/**
 * Yonetici destek araci: hedef kullanici olarak 30 dakikalik access token.
 * Refresh token verilmez; sure dolunca ya da admin yetkisini kaybedince oturum biter.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  // Zincirleme goruntuleme yok (hedef zaten ADMIN olamaz; bu ikinci kilit).
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;

  const { id } = await params;
  const result = await adminUserService.startImpersonation(id, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  }, "mobile");
  if (!result.ok) {
    if (result.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const { target } = result;
  const { token, expiresAt } = await signImpersonationToken(
    target.id,
    target.role,
    auth.user.id,
    target.tokenVersion,
  );
  return NextResponse.json({
    accessToken: token,
    expiresAt: expiresAt.toISOString(),
    // Istemci zamanlayiciyi buna kurar: cihaz saati kaymis olsa da oturum zamaninda biter.
    expiresInSeconds: IMPERSONATION_TTL_SECONDS,
    user: toMobileUser(target),
  });
}
