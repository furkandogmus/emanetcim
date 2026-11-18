import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileGalleryImage } from "@/lib/mobile-dto";
import { isStorageConfigured } from "@/lib/storage";
import { shopGalleryService } from "@/services/ShopGalleryService";
import { shopService } from "@/services/ShopService";

const ERROR_STATUS = {
  not_found: 404,
  not_owner: 403,
  limit: 409,
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  dimensions_too_large: 413,
} as const;

/** Galeriye fotograf ekler (kapak ayri: `/partner/shop/image`). Dukkan oturumdaki esnafin. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;
  if (!isStorageConfigured()) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const shop = await shopService.getShopByOwner(auth.user.id, req.nextUrl.searchParams.get("shop"));
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "empty" }, { status: 400 });

  const result = await shopGalleryService.add({
    shopId: shop.id,
    actorId: auth.user.id,
    actorRole: auth.user.role,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: ERROR_STATUS[result.reason] });
  return NextResponse.json(toMobileGalleryImage(result));
}
