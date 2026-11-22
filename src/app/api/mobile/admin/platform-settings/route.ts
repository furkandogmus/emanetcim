import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminPlatformSettings } from "@/lib/mobile-dto";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { getPlatformSettingsForAdmin, updatePlatformSettings } from "@/services/PlatformSettingsService";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  return NextResponse.json(toMobileAdminPlatformSettings(await getPlatformSettingsForAdmin()));
}

/**
 * PUT `{ values, confirmation, expectedUpdatedAt }`. `expectedUpdatedAt` GET'teki
 * `updatedAt` (hic kaydedilmemisse `null`); arada baskasi kaydettiyse 409 `stale_settings`.
 * Riskli degisiklikte onay yoksa 428 `confirmation_required` + `changes` (eski -> yeni) + `phrase`.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { values, confirmation, expectedUpdatedAt } = await readOpsBody(req);
  if (expectedUpdatedAt !== null && typeof expectedUpdatedAt !== "string") return opsError("invalid_data");
  const result = await updatePlatformSettings(auth.user, values, {
    ip: clientIp(req),
    requireConfirmation: true,
    confirmation,
    expectedUpdatedAt,
  });
  if (!result.ok) {
    return result.reason === "confirmation_required"
      ? opsError(result.reason, { changes: result.changes, phrase: result.phrase })
      : opsError(result.reason);
  }
  return NextResponse.json(toMobileAdminPlatformSettings(await getPlatformSettingsForAdmin()));
}
