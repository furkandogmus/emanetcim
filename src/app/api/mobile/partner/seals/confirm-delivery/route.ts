import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { sealService } from "@/services/SealService";
import { SEAL_CODE_TO_HTTP } from "@/lib/mobile-seal-response";

/**
 * Esnaf: kargoyu teslim aldigini mobilden bildirir.
 *
 * 2026-08-25'e kadar bu uc yalnizca `sealRequest.status = DELIVERED` yaziyordu ve
 * MUHURLERI DUKKANA HIC ATAMIYORDU. Esnaf "teslim aldim" dedikten sonra elinde
 * kullanilabilir muhur olmuyor, check-in "muhur bu dukkana atanmamis" diye
 * reddediyordu. Atama artik `SealService.confirmDelivery` icinde, durum
 * guncellemesiyle ayni transaction'da.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const { requestId } = await req.json().catch(() => ({ requestId: undefined }));
  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const result = await sealService.confirmDelivery(requestId, {
    id: auth.user.id,
    role: "PARTNER",
  });

  if (!result.ok) {
    const { status, error } = SEAL_CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ success: true, assignedCount: result.assignedCount });
}
