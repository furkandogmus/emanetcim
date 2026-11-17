import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { toMobileAdminBookingDetail } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminOpsService } from "@/services/AdminOpsService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const detail = await adminOpsService.bookingDetail(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(toMobileAdminBookingDetail(detail));
}
