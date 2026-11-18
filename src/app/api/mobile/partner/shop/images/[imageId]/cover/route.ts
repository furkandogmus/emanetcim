import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopGalleryService } from "@/services/ShopGalleryService";
import { shopService } from "@/services/ShopService";

/** Galerideki fotografi kapak yapar; eski kapak galeriye gecer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;

  const shop = await shopService.getShopByOwner(auth.user.id, req.nextUrl.searchParams.get("shop"));
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { imageId } = await params;
  const result = await shopGalleryService.makeCover({
    shopId: shop.id,
    imageId,
    actorId: auth.user.id,
    actorRole: auth.user.role,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.reason === "not_owner" ? 403 : 404 });
  return NextResponse.json({ success: true });
}
