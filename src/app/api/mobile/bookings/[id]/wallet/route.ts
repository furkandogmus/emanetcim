import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { toMobileWalletLink } from "@/lib/mobile-dto";
import { walletRateLimit } from "@/lib/wallet/http";
import { walletPassService } from "@/services/WalletPassService";

/**
 * Uygulamanin "Cuzdana ekle" dugmesi. Yalnizca rezervasyonun misafiri; baskasinin
 * kimligi 404 alir (varligi sizdirilmaz). Donen bag tarayicida acilir.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  const limited = await walletRateLimit(req, `mobile:${auth.user.id}`, 20, 10 * 60_000);
  if (limited) return limited;

  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "apple" && kind !== "google") return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  const { id } = await params;
  const result = await walletPassService.linkForOwner(id, auth.user.id, kind);
  if (!result.ok) {
    const status = result.code === "not_available" ? 409 : 404;
    return NextResponse.json({ error: result.code }, { status });
  }
  return NextResponse.json(toMobileWalletLink(kind, result.link.url, result.link.expiresAt), {
    headers: { "Cache-Control": "no-store" },
  });
}
