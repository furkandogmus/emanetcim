import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { toMobileAdminUser } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { parseCursor } from "@/lib/cursor-page";
import { adminUserService, type AdminUserFilters } from "@/services/AdminUserService";

const ROLES = new Set(["GUEST", "PARTNER", "ADMIN"]);
const STATUSES = new Set(["ACTIVE", "BANNED", "UNVERIFIED"]);
const TYPES = new Set(["REAL", "TEST"]);

/** Bilinmeyen deger suzgec degildir (eski/bozuk istemci listeyi bos gormesin). */
function pick<T extends string>(raw: string | null, allowed: Set<string>): T | null {
  return raw && allowed.has(raw) ? (raw as T) : null;
}

/**
 * Ad, e-posta ya da telefonla kullanici arama; bos sorgu en yeniler. `?cursor=` sonraki sayfa.
 * Web ile ayni suzgecler: `?role=GUEST|PARTNER|ADMIN`, `?status=ACTIVE|BANNED|UNVERIFIED`, `?type=REAL|TEST`.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").slice(0, 100);
  const filters: AdminUserFilters = {
    role: pick<NonNullable<AdminUserFilters["role"]>>(sp.get("role"), ROLES),
    status: pick<NonNullable<AdminUserFilters["status"]>>(sp.get("status"), STATUSES),
    type: pick<NonNullable<AdminUserFilters["type"]>>(sp.get("type"), TYPES),
  };
  const page = await adminUserService.searchPage(q, { cursor: parseCursor(sp.get("cursor")), filters });
  return NextResponse.json({ users: page.items.map(toMobileAdminUser), nextCursor: page.nextCursor });
}
