import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminShopPhotos, toMobileGalleryImage } from "@/lib/mobile-dto";
import { isStorageConfigured } from "@/lib/storage";
import { shopGalleryService } from "@/services/ShopGalleryService";
import { revalidateShopContent } from "../revalidate";

/*
  Yonetici, esnaf adina dukkan fotograflari. Govde esnafin ucuyla AYNI servis
  (`ShopGalleryService`): sahiplik kurali orada ve ADMIN'e her dukkani acar.
  Esnaf ucundan farki dukkanin URL'den gelmesi; esnaf ucu dukkani oturumdaki
  sahipten cozer (`getShopByOwner`) ve oyle kalir. Denetim kaydi serviste.
*/
const ERROR_STATUS = {
  not_found: 404,
  not_owner: 403,
  limit: 409,
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  dimensions_too_large: 413,
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const shop = await prisma.shop.findUnique({ where: { id }, select: { image: true } });
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const gallery = await shopGalleryService.list(id);
  return NextResponse.json(toMobileAdminShopPhotos({ image: shop.image, gallery }));
}

/** Galeriye fotograf ekler (kapak ayri: `admin/shops/:id/image`). */
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

  const result = await shopGalleryService.add({
    shopId: id,
    actorId: auth.user.id,
    actorRole: auth.user.role,
    actorIp: clientIpFromRequest(req),
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: ERROR_STATUS[result.reason] });
  revalidateShopContent(id);
  return NextResponse.json(toMobileGalleryImage(result));
}
