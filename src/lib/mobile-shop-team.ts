import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import type { MobileActor } from "@/lib/mobile-auth";

/**
 * Ekip uclarinin ortak kapisi: oturum + `manage` seviyesinde secili dukkan (`?shop=`,
 * yalniz sahip olunanlar). Yazma uclarinda yonetici goruntulemesi kapali: ekip
 * degisikligi denetim kaydina "yonetici" diye dusmeli, hedef esnaf adina degil.
 */
export async function teamGate(req: NextRequest, opts: { write: boolean }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return { error: auth.error };
  if (opts.write) {
    const blocked = forbidWhileImpersonating(auth.user);
    if (blocked) return { error: blocked };
  }
  const { activeShop } = await resolvePartnerShops(auth.user.id, req.nextUrl.searchParams.get("shop"), "manage");
  if (!activeShop) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user: auth.user as MobileActor, shop: { id: activeShop.id, name: activeShop.name } };
}
