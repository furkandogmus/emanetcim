import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopGalleryService } from "@/services/ShopGalleryService";
import { revalidateShopContent } from "../../revalidate";

/** Yonetici galeriden fotograf siler; govde esnaf ucuyla ayni (`ShopGalleryService.remove`). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;

  const { id, imageId } = await params;
  const result = await shopGalleryService.remove({
    shopId: id,
    imageId,
    actorId: auth.user.id,
    actorRole: auth.user.role,
    actorIp: clientIpFromRequest(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.reason === "not_owner" ? 403 : 404 });
  revalidateShopContent(id);
  return NextResponse.json({ success: true });
}
