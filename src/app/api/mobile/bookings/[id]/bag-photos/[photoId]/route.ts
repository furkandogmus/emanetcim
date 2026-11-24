import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { BAG_PHOTO_ERROR_STATUS } from "@/lib/bag-photo-http";
import { bagPhotoService } from "@/services/BagPhotoService";

/** Operator (pencere acikken) ya da yonetici fotografi siler. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const { id, photoId } = await params;
  const result = await bagPhotoService.remove({ ...auth.user, ip: clientIpFromRequest(req) }, id, photoId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: BAG_PHOTO_ERROR_STATUS[result.reason] });
  return NextResponse.json({ ok: true });
}
