"use server";

import { z } from "zod";
import { getClientIpOrNull } from "@/lib/client-ip";
import { actionSession, requireUser } from "@/lib/action-auth";
import { asImpersonationRead } from "@/lib/impersonation-read-scope";
import { BAG_PHOTO_MAX_BYTES } from "@/lib/bag-photos";
import { bagPhotoService, type BagPhotoFailure, type BagPhotoList } from "@/services/BagPhotoService";

// Web tasiyicilari; govde `BagPhotoService` (mobil uclar ayni servisi cagirir).
const id = z.string().uuid();

type Result<T> = { success: true; data: T } | { success: false; code: BagPhotoFailure | "auth" };

async function listBagPhotosActionImpl(bookingId: string): Promise<Result<BagPhotoList>> {
  // Goruntuleme oturumunda hedefin gozuyle OKUR (mobil ile ayni); yazma action'lari kapali kalir.
  const session = await actionSession();
  if (!session?.user?.id) return { success: false, code: "auth" };
  if (!id.safeParse(bookingId).success) return { success: false, code: "not_found" };
  const impersonatedBy = session.impersonation && "adminId" in session.impersonation ? session.impersonation.adminId : undefined;
  const r = await bagPhotoService.list(
    { id: session.user.id, role: session.user.role, ...(session.impersonation ? { impersonatedBy: impersonatedBy ?? "unknown" } : {}) },
    bookingId,
  );
  if (!r.ok) return { success: false, code: r.reason };
  const { ok: _ok, ...data } = r;
  return { success: true, data };
}

/** Salt okuma: "olarak goruntule" oturumunda da calisir (`asImpersonationRead`). */
export async function listBagPhotosAction(bookingId: string): Promise<Result<BagPhotoList>> {
  return asImpersonationRead(() => listBagPhotosActionImpl(bookingId));
}

export async function uploadBagPhotoAction(bookingId: string, form: FormData): Promise<Result<{ id: string }>> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, code: "auth" };
  if (!id.safeParse(bookingId).success) return { success: false, code: "not_found" };
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return { success: false, code: "empty" };
  if (file.size > BAG_PHOTO_MAX_BYTES) return { success: false, code: "too_large" };
  const r = await bagPhotoService.upload(
    { ...auth.actor, ip: await getClientIpOrNull() },
    bookingId,
    new Uint8Array(await file.arrayBuffer()),
  );
  return r.ok ? { success: true, data: { id: r.id } } : { success: false, code: r.reason };
}

export async function deleteBagPhotoAction(bookingId: string, photoId: string): Promise<Result<null>> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, code: "auth" };
  if (!id.safeParse(bookingId).success || !id.safeParse(photoId).success) return { success: false, code: "not_found" };
  const r = await bagPhotoService.remove({ ...auth.actor, ip: await getClientIpOrNull() }, bookingId, photoId);
  return r.ok ? { success: true, data: null } : { success: false, code: r.reason };
}
