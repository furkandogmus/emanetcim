import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { toMobileAdminUser } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { parseCursor } from "@/lib/cursor-page";
import { adminUserService } from "@/services/AdminUserService";

/** Ad, e-posta ya da telefonla kullanici arama; bos sorgu en yeniler. `?cursor=` sonraki sayfa. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").slice(0, 100);
  const page = await adminUserService.searchPage(q, { cursor: parseCursor(sp.get("cursor")) });
  return NextResponse.json({ users: page.items.map(toMobileAdminUser), nextCursor: page.nextCursor });
}
