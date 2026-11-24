import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { toMobileBagPhotoList } from "@/lib/mobile-dto";
import { BAG_PHOTO_ERROR_STATUS } from "@/lib/bag-photo-http";
import { BAG_PHOTO_MAX_BYTES } from "@/lib/bag-photos";
import { bagPhotoService } from "@/services/BagPhotoService";

type Ctx = { params: Promise<{ id: string }> };

/** Valiz durumu fotograflari: misafir, dukkan operatoru ve yonetici okur (goruntulemede de). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const result = await bagPhotoService.list(auth.user, id);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: BAG_PHOTO_ERROR_STATUS[result.reason] });
  return NextResponse.json(toMobileBagPhotoList(result), { headers: { "Cache-Control": "private, no-store" } });
}

/** Operator teslimde fotograf ekler (multipart `file`, JPEG). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  // Govde okunmadan buyuk istek reddedilir (multipart zarfi icin kucuk pay).
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > BAG_PHOTO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "empty" }, { status: 400 });
  const result = await bagPhotoService.upload(
    { ...auth.user, ip: clientIpFromRequest(req) },
    id,
    new Uint8Array(await file.arrayBuffer()),
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: BAG_PHOTO_ERROR_STATUS[result.reason] });
  return NextResponse.json({ ok: true, id: result.id });
}
