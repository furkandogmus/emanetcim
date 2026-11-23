import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminDeletionRequest } from "@/lib/mobile-dto";
import { accountPrivacyService } from "@/services/AccountPrivacyService";

/** Hesap silme talepleri (web `/admin/account-deletions` ile ayni sorgu). */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const rows = await accountPrivacyService.listDeletionRequests();
  return NextResponse.json({ items: rows.map(toMobileAdminDeletionRequest) });
}
