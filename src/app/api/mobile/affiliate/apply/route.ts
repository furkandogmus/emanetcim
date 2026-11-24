import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { affiliateService } from "@/services/AffiliateService";

/** Aracı başvurusu; hesap bağlanır. Gövde ve hız sınırı web `applyAffiliateAction` ile aynı servis. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const result = await affiliateService.apply(body ?? {}, { userId: auth.user.id, ip: clientIpFromRequest(req) });
  if (!result.ok) {
    const status = result.reason === "rate_limited" ? 429 : result.reason === "already_applied" ? 409 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
