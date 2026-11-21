import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { toMobileAdminBookingRow } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { parseCursor } from "@/lib/cursor-page";
import { ADMIN_BOOKING_FILTERS, adminOpsService, type AdminBookingFilter } from "@/services/AdminOpsService";

/**
 * `?filter=arrivals|pickups|inStorage|overdue|noShow|upcoming|all&q=kod/ad/e-posta/dukkan&cursor=`
 * `nextCursor` doluysa devami var; eski istemci alani okumaz, ilk 50'yi gorur.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const sp = req.nextUrl.searchParams;
  const raw = sp.get("filter") ?? "all";
  const filter: AdminBookingFilter = (ADMIN_BOOKING_FILTERS as readonly string[]).includes(raw)
    ? (raw as AdminBookingFilter)
    : "all";
  const q = (sp.get("q") ?? "").slice(0, 80);

  const page = await adminOpsService.listBookingsPage({ filter, q, cursor: parseCursor(sp.get("cursor")) });
  return NextResponse.json({ bookings: page.items.map(toMobileAdminBookingRow), nextCursor: page.nextCursor });
}
