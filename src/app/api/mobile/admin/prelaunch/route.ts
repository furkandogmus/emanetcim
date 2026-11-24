import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminPrelaunch } from "@/lib/mobile-dto";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";

/** Talep testi sonuclari (salt okuma): sehir ve nokta kirilimi web ile ortak (`adminReport`). */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  return NextResponse.json(toMobileAdminPrelaunch(await prelaunchInterestService.adminReport()));
}
