import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { adminUpdateFeatureFlag } from "@/services/FeatureFlagService";

/**
 * PATCH `/admin/feature-flags/<anahtar>` `{ enabled, rolloutPct, allowedUserIds, description, confirmation }`.
 * Yol parametresi bayragin anahtari (klasor adi `[id]`: mobil sozlesme testi yolu boyle esler).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { id: key } = await params;
  const { enabled, rolloutPct, allowedUserIds, description, confirmation } = await readOpsBody(req);
  const result = await adminUpdateFeatureFlag(
    auth.user,
    { key, enabled, rolloutPct, allowedUserIds, description },
    { ip: clientIp(req), requireConfirmation: true, confirmation, onlyExisting: true },
  );
  if (!result.ok) return opsError(result.reason);
  return NextResponse.json({ success: true });
}
