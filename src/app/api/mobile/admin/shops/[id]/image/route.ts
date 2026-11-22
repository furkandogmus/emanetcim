import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { isStorageConfigured } from "@/lib/storage";
import { shopService } from "@/services/ShopService";
import { revalidateShopContent } from "../revalidate";

/*
  Yonetici, esnaf adina kapak fotografi. Govde esnafin `partner/shop/image`
  ucu ve web `updateShopImageAction` ile ayni: `ShopService.setShopImage`
  (sahiplik -> bayt dogrulama -> S3 -> eski nesneyi silme -> denetim kaydi).
*/
const ERROR_STATUS = {
  not_found: 404,
  not_owner: 403,
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  dimensions_too_large: 413,
} as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  if (!isStorageConfigured()) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "empty" }, { status: 400 });

  const result = await shopService.setShopImage({
    shopId: id,
    actorId: auth.user.id,
    actorRole: auth.user.role,
    actorIp: clientIpFromRequest(req),
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: ERROR_STATUS[result.reason] });
  revalidateShopContent(id);
  return NextResponse.json({ url: result.url });
}
