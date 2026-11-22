import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { clientIp } from "@/lib/internal-api-guard";
import { closureResponse, readJsonBody } from "@/lib/booking-closure-http";
import { adminCancelBooking } from "@/services/booking/closure";

/** POST `{ note }` -> yonetici iptali. Govde `adminCancelBooking`te (web de onu cagirir). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { id } = await params;
  const body = await readJsonBody(req);
  return closureResponse(
    await adminCancelBooking(id, auth.user, { note: body.note, ip: clientIp(req) }),
  );
}
