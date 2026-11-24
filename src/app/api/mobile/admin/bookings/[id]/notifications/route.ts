import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { toMobileAdminBookingNotification } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminOpsService } from "@/services/AdminOpsService";

/** Rezervasyonun bildirim kaydi (web admin rezervasyon detayindaki "Bildirimler"). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const rows = await adminOpsService.bookingNotifications(id);
  if (!rows) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ notifications: rows.map(toMobileAdminBookingNotification) });
}
