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
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  return NextResponse.json(toMobileAdminPlatformSettings(await getPlatformSettingsForAdmin()));
}

/**
 * PUT `{ values, confirmation }`. Riskli alan (para, muhur, minimum surum) degisiyorsa
 * `confirmation` yazilmis olmali; yoksa 428 `confirmation_required` + `fields`.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  const { values, confirmation } = await readOpsBody(req);
  const result = await updatePlatformSettings(auth.user, values, {
    ip: clientIp(req),
    requireConfirmation: true,
    confirmation,
  });
  if (!result.ok) {
    return result.reason === "confirmation_required"
      ? opsError(result.reason, { fields: result.fields })
      : opsError(result.reason);
  }
  return NextResponse.json(toMobileAdminPlatformSettings(await getPlatformSettingsForAdmin()));
}
