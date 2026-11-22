import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { clientIp } from "@/lib/internal-api-guard";
import { closureResponse, readJsonBody } from "@/lib/booking-closure-http";
import { adminForceCheckOut } from "@/services/booking/closure";

/** POST `{ note }` -> yonetici zorla teslimi (yalniz CHECKED_IN, gecikme ucreti yok). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { id } = await params;
  const body = await readJsonBody(req);
  return closureResponse(
    await adminForceCheckOut(id, auth.user, { note: body.note, ip: clientIp(req) }),
  );
}
