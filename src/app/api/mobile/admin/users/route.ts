import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { toMobileAdminUser } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminUserService } from "@/services/AdminUserService";

/** Ad, e-posta ya da telefonla kullanici arama; bos sorgu son 50 kayit. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const users = await adminUserService.search(q);
  return NextResponse.json({ users: users.map(toMobileAdminUser) });
}
