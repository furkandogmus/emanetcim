import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminFeatureFlag } from "@/lib/mobile-dto";
import { featureFlagService } from "@/services/FeatureFlagService";

/** Yonetici listesi (degerlendirme degil, ham ayar). Istemci bayraklari `/feature-flags`tan okur. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const rows = await featureFlagService.listAll();
  return NextResponse.json({ items: rows.map(toMobileAdminFeatureFlag) });
}
