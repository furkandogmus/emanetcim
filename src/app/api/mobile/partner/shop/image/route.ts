import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { isStorageConfigured } from "@/lib/storage";
import { shopService } from "@/services/ShopService";

/*
  Esnafin dukkan vitrin fotografi. Govde web `updateShopImageAction` ile ayni
  servis (`setShopImage`): sahiplik -> bayt dogrulama -> S3 -> eski nesneyi
  silme. Dukkan istemciden alinmaz, oturumdaki esnafin dukkanidir.
*/
const ERROR_STATUS = {
  not_found: 404,
  not_owner: 403,
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  dimensions_too_large: 413,
} as const;

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  const shop = await shopService.getShopByOwner(auth.user.id, req.nextUrl.searchParams.get("shop"));
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "empty" }, { status: 400 });

  const result = await shopService.setShopImage({
    shopId: shop.id,
    actorId: auth.user.id,
    actorRole: auth.user.role,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: ERROR_STATUS[result.reason] });
  }
  return NextResponse.json({ url: result.url });
}
