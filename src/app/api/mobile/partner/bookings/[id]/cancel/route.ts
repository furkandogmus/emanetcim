import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { closureResponse, readJsonBody } from "@/lib/booking-closure-http";
import { partnerCancelBooking } from "@/services/booking/closure";

/**
 * POST `{ reason, note? }` -> esnaf iptali. Dukkan sahipligi serviste
 * (`canOperateBookingAtShop`): sahip olmayan esnaf `forbidden` alir.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJsonBody(req);
  return closureResponse(await partnerCancelBooking(id, auth.user, { reason: body.reason, note: body.note }));
}
